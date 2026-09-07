import assert from "node:assert";

function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hasTimeOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

/**
 * Lógica pura de cálculo de culminación anticipada por servicio
 */
function calculateServiceEarlyRelease(params: {
  serviceStartTime: string;
  serviceEndTime: string;
  serviceOriginalDuration: number;
  releaseTime: string;
}) {
  const { serviceStartTime, serviceEndTime, serviceOriginalDuration, releaseTime } = params;
  const startMinutes = timeToMinutes(serviceStartTime);
  let releaseMinutes = timeToMinutes(releaseTime);
  const origEndMinutes = timeToMinutes(serviceEndTime);

  // Regla de duración mínima de 1 minuto si se libera antes o en el mismo minuto de inicio
  if (releaseMinutes <= startMinutes) {
    releaseMinutes = startMinutes + 1;
  }

  let finalEndTime: string;
  let finalDurationMinutes: number;

  if (releaseMinutes < origEndMinutes) {
    // Culminación anticipada real: recorte horario
    finalDurationMinutes = Math.max(1, releaseMinutes - startMinutes);
    finalEndTime = `${minutesToTime(releaseMinutes)}:00`;
  } else {
    // Si la hora actual ya superó el horario programado, se conserva la hora de término programada
    finalEndTime = serviceEndTime;
    finalDurationMinutes = serviceOriginalDuration || Math.max(1, origEndMinutes - startMinutes);
  }

  return {
    finalEndTime,
    finalDurationMinutes,
    status: "completada" as const,
  };
}

/**
 * Recálculo de cita padre a partir del estado de todos sus servicios
 */
function recalculateParentBookingAfterRelease(params: {
  bookingStartTime: string;
  services: Array<{
    id: string;
    end_time: string;
    status: string;
  }>;
}) {
  const { bookingStartTime, services } = params;
  const allCompleted = services.every((s) => s.status === "completada");
  const endMinutesArray = services.map((s) => timeToMinutes(s.end_time));
  const maxEndMinutes = Math.max(...endMinutesArray);
  const maxEndTimeStr = `${minutesToTime(maxEndMinutes)}:00`;

  const bkgStartMinutes = timeToMinutes(bookingStartTime);
  const totalDurationMinutes = Math.max(1, maxEndMinutes - bkgStartMinutes);

  return {
    end_time: maxEndTimeStr,
    total_duration_minutes: totalDurationMinutes,
    status: allCompleted ? "completada" : "confirmada",
    allCompleted,
  };
}

console.log("==========================================================================");
console.log(" ⚡ SUITE DE PRUEBAS: CULMINACIÓN ANTICIPADA Y LIBERACIÓN POR SERVICIO");
console.log("==========================================================================\n");

// --- 1. Caso 1: Cita Simple con 1 Servicio (Liberación Anticipada) ---
console.log("--- 1. Cita Individual (1 solo servicio) ---");
{
  const originalService = {
    id: "svc-1",
    service_name: "Corte y Barba",
    start_time: "18:00:00",
    end_time: "20:00:00",
    duration_minutes: 120,
    service_price_cents: 5000, // S/ 50.00
    status: "confirmada",
  };

  const booking = {
    id: "bkg-1",
    booking_code: "ACI-2026-001",
    booking_date: "2026-09-07",
    start_time: "18:00:00",
    end_time: "20:00:00",
    total_duration_minutes: 120,
    total_price_cents: 5000,
    advance_amount_cents: 2500,
    balance_cents: 2500,
    status: "confirmada",
  };

  // El barbero termina a las 19:00:00 (1 hora antes)
  const result = calculateServiceEarlyRelease({
    serviceStartTime: originalService.start_time,
    serviceEndTime: originalService.end_time,
    serviceOriginalDuration: originalService.duration_minutes,
    releaseTime: "19:00:00",
  });

  assert.strictEqual(result.finalEndTime, "19:00:00", "La hora fin debe ser exactamente las 19:00:00");
  assert.strictEqual(result.finalDurationMinutes, 60, "La duración real debe recortarse a 60 minutos");
  assert.strictEqual(result.status, "completada", "El servicio debe marcarse como completada");
  console.log("  [PASS] Servicio recortado a 19:00:00 con 60 min de duración real y status 'completada'");

  // Verificar cita padre
  const parentResult = recalculateParentBookingAfterRelease({
    bookingStartTime: booking.start_time,
    services: [{ id: originalService.id, end_time: result.finalEndTime, status: result.status }],
  });

  assert.strictEqual(parentResult.end_time, "19:00:00", "La cita padre debe recortarse a 19:00:00");
  assert.strictEqual(parentResult.total_duration_minutes, 60, "La duración total de la cita debe ser 60 min");
  assert.strictEqual(parentResult.status, "completada", "La cita padre debe pasar a 'completada'");
  console.log("  [PASS] Cita padre sincronizada a 19:00:00 con status 'completada'");

  // Verificar salvaguarda financiera
  assert.strictEqual(originalService.service_price_cents, 5000, "El precio del servicio NO debe alterarse");
  assert.strictEqual(booking.total_price_cents, 5000, "El total de la reserva NO debe alterarse");
  assert.strictEqual(booking.balance_cents, 2500, "El saldo pendiente NO debe alterarse");
  console.log("  [PASS] Integridad financiera intacta (Precios y saldos inalterados)");
}

// --- 2. Caso 2: Liberación Inmediata de Disponibilidad en Agenda ---
console.log("\n--- 2. Liberación Inmediata de Disponibilidad ---");
{
  const previousEndTime = "20:00:00";
  const newEndTime = "19:00:00";
  const candidateSlotStart = "19:00:00";
  const candidateSlotEnd = "19:30:00";

  // Con el bloqueo original (hasta las 20:00) había solapamiento
  const overlapBefore = hasTimeOverlap("18:00:00", previousEndTime, candidateSlotStart, candidateSlotEnd);
  assert.strictEqual(overlapBefore, true, "Con el bloqueo original de 18:00 a 20:00 había colisión a las 19:00");
  console.log("  [PASS] Agenda anterior: 18:00 a 20:00 bloqueaba el turno 19:00-19:30 (Colisión = true)");

  // Con la hora recortada (hasta las 19:00) NO hay solapamiento
  const overlapAfter = hasTimeOverlap("18:00:00", newEndTime, candidateSlotStart, candidateSlotEnd);
  assert.strictEqual(overlapAfter, false, "Al culminar a las 19:00:00 NO debe existir solapamiento a las 19:00");
  console.log("  [PASS] Agenda liberada: 18:00 a 19:00 NO colisiona con turno 19:00-19:30 (Colisión = false)");

  // Franja interior antes de la liberación sigue bloqueada
  const overlapInside = hasTimeOverlap("18:00:00", newEndTime, "18:30:00", "19:00:00");
  assert.strictEqual(overlapInside, true, "La franja 18:30-19:00 sigue correctamente ocupada por la atención");
  console.log("  [PASS] Franja interna de atención (18:30 a 19:00) sigue protegida");
}

// --- 3. Caso 3: Reserva Múltiple con Servicios Paralelos e Independientes ---
console.log("\n--- 3. Reserva Múltiple Paralela (Independencia por Servicio) ---");
{
  const serviceWorkerA = {
    id: "svc-A",
    workerId: "emp-jorge",
    name: "Corte Degradado",
    start_time: "18:00:00",
    end_time: "20:00:00", // Originalmente hasta las 20:00
    duration_minutes: 120,
    status: "confirmada",
  };

  const serviceWorkerB = {
    id: "svc-B",
    workerId: "emp-maria",
    name: "Limpieza Facial Spa",
    start_time: "18:00:00",
    end_time: "19:30:00", // Atendiendo hasta las 19:30
    duration_minutes: 90,
    status: "confirmada",
  };

  const booking = {
    id: "bkg-multi",
    start_time: "18:00:00",
    end_time: "20:00:00",
    status: "confirmada",
  };

  // Jorge termina su corte anticipadamente a las 18:45:00
  const releaseA = calculateServiceEarlyRelease({
    serviceStartTime: serviceWorkerA.start_time,
    serviceEndTime: serviceWorkerA.end_time,
    serviceOriginalDuration: serviceWorkerA.duration_minutes,
    releaseTime: "18:45:00",
  });

  assert.strictEqual(releaseA.finalEndTime, "18:45:00");
  assert.strictEqual(releaseA.finalDurationMinutes, 45);
  assert.strictEqual(releaseA.status, "completada");
  console.log("  [PASS] Servicio A (Jorge) culminado a las 18:45:00 (Duración: 45 min, Status: completada)");

  // Validar disponibilidad de Jorge a partir de las 18:45:00
  const jorgeOverlapAt1845 = hasTimeOverlap("18:00:00", releaseA.finalEndTime, "18:45:00", "19:15:00");
  assert.strictEqual(jorgeOverlapAt1845, false, "Jorge debe estar libre desde las 18:45:00");
  console.log("  [PASS] Jorge queda 100% disponible a partir de las 18:45:00");

  // El servicio B de María permanece INTACTO (hasta las 19:30:00 y en curso)
  assert.strictEqual(serviceWorkerB.end_time, "19:30:00", "El servicio de María no debe alterarse");
  assert.strictEqual(serviceWorkerB.status, "confirmada", "El servicio de María debe seguir en curso");
  const mariaOverlap = hasTimeOverlap("18:00:00", serviceWorkerB.end_time, "19:00:00", "19:30:00");
  assert.strictEqual(mariaOverlap, true, "María sigue ocupada hasta las 19:30:00");
  console.log("  [PASS] Servicio B (María) sigue activo hasta las 19:30:00 sin verse afectado");

  // Recalcular estado de la cita padre: como María sigue atendiendo, la cita NO se cierra
  const parentRecalc = recalculateParentBookingAfterRelease({
    bookingStartTime: booking.start_time,
    services: [
      { id: serviceWorkerA.id, end_time: releaseA.finalEndTime, status: releaseA.status },
      { id: serviceWorkerB.id, end_time: serviceWorkerB.end_time, status: serviceWorkerB.status },
    ],
  });

  assert.strictEqual(parentRecalc.allCompleted, false, "La cita no está completa porque María sigue atendiendo");
  assert.strictEqual(parentRecalc.status, "confirmada", "El estado de la cita padre sigue siendo 'confirmada'");
  assert.strictEqual(parentRecalc.end_time, "19:30:00", "La hora fin de la cita es 19:30:00 (servicio de María)");
  assert.strictEqual(parentRecalc.total_duration_minutes, 90, "La duración de la cita padre se ajustó a 90 min");
  console.log("  [PASS] Cita padre mantiene hora fin en 19:30:00 y status 'confirmada' mientras haya servicios activos");

  // Ahora María también culmina a las 19:10:00 (anticipado a su 19:30:00)
  const releaseB = calculateServiceEarlyRelease({
    serviceStartTime: serviceWorkerB.start_time,
    serviceEndTime: serviceWorkerB.end_time,
    serviceOriginalDuration: serviceWorkerB.duration_minutes,
    releaseTime: "19:10:00",
  });

  const parentFinalRecalc = recalculateParentBookingAfterRelease({
    bookingStartTime: booking.start_time,
    services: [
      { id: serviceWorkerA.id, end_time: releaseA.finalEndTime, status: releaseA.status },
      { id: serviceWorkerB.id, end_time: releaseB.finalEndTime, status: releaseB.status },
    ],
  });

  assert.strictEqual(parentFinalRecalc.allCompleted, true, "Ahora todos los servicios están culminados");
  assert.strictEqual(parentFinalRecalc.status, "completada", "La cita padre pasa a 'completada'");
  assert.strictEqual(parentFinalRecalc.end_time, "19:10:00", "La hora fin global de la cita es 19:10:00");
  assert.strictEqual(parentFinalRecalc.total_duration_minutes, 70, "La duración total real de la cita fue 70 min");
  console.log("  [PASS] Al culminar el último servicio, cita padre se actualiza a 19:10:00 con status 'completada'");
}

// --- 4. Caso 4: Casos Límite y Protección de Duración Mínima ---
console.log("\n--- 4. Casos Límite y Protección ---");
{
  // Intento de liberar en el mismo minuto de inicio (18:00)
  const edgeCaseImmediate = calculateServiceEarlyRelease({
    serviceStartTime: "18:00:00",
    serviceEndTime: "19:00:00",
    serviceOriginalDuration: 60,
    releaseTime: "18:00:00",
  });

  assert.strictEqual(edgeCaseImmediate.finalEndTime, "18:01:00", "Garantiza al menos 1 minuto de duración");
  assert.strictEqual(edgeCaseImmediate.finalDurationMinutes, 1, "La duración mínima es 1 minuto");
  console.log("  [PASS] Liberación inmediata al inicio garantiza duración mínima de 1 minuto (18:01:00)");

  // Intento de liberar después del horario programado (ej. a las 19:20 cuando era hasta las 19:00)
  const edgeCaseLate = calculateServiceEarlyRelease({
    serviceStartTime: "18:00:00",
    serviceEndTime: "19:00:00",
    serviceOriginalDuration: 60,
    releaseTime: "19:20:00",
  });

  assert.strictEqual(edgeCaseLate.finalEndTime, "19:00:00", "No debe extender el horario si ya venció");
  assert.strictEqual(edgeCaseLate.status, "completada", "Simplemente se marca como completada");
  console.log("  [PASS] Culminación posterior al horario programado no desborda la agenda y marca completada");
}

console.log("\n==========================================================================");
console.log(" 🏁 RESULTADO: Todas las pruebas de culminación y liberación superadas.");
console.log("==========================================================================\n");
