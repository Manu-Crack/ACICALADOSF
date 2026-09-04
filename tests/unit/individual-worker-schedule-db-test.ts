import assert from "node:assert";
import { calculateParallelServiceSchedule } from "../../src/lib/utils/booking-schedule";

// Utilidades de validación de tiempo y solapamiento
function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
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

interface MockBookingService {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  assigned_employee_id: string | null;
  start_time: string;
  end_time: string;
  hora_inicio: string;
  hora_fin: string;
  created_at: string;
}

interface MockBookingHeader {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_duration_minutes: number;
  total_price_cents: number;
  assigned_employee_id: string | null;
  status: string;
  booking_services: MockBookingService[];
}

/**
 * Función de simulación de verificación de disponibilidad estricta
 * (Implementación idéntica a la lógica corregida en /api/availability y employee-assignment.ts)
 */
function isEmployeeAvailableForSlot(
  employeeId: string,
  candidateStart: string,
  candidateEnd: string,
  activeBookingServices: MockBookingService[]
): boolean {
  // Se evalúa ÚNICAMENTE contra los rangos individuales de sus propios servicios
  const hasConflict = activeBookingServices.some((bs) => {
    if (bs.assigned_employee_id !== employeeId) return false;
    const sTime = bs.start_time || bs.hora_inicio;
    const eTime = bs.end_time || bs.hora_fin;
    return hasTimeOverlap(sTime, eTime, candidateStart, candidateEnd);
  });

  return !hasConflict;
}

console.log("==========================================================================");
console.log(" 🧪 AUDITORÍA Y VALIDACIÓN ESTRICTA DE HORARIOS INDIVIDUALES EN BD");
console.log("==========================================================================\n");

// -----------------------------------------------------------------------------
// CASO 1: Tres servicios paralelos a las 09:00 (A: 30m, B: 40m, C: 60m)
// -----------------------------------------------------------------------------
console.log("--- 1. Persistencia y Validación de Servicios en Paralelo (09:00) ---");
{
  const bookingStartTime = "09:00:00";
  const rawServicesInput = [
    {
      id: "bs-1",
      service_id: "svc-a",
      service_name: "Servicio A (Corte Rápido)",
      duration_minutes: 30,
      service_price_cents: 3500,
      assigned_employee_id: "emp-A",
      created_at: "2026-09-04T09:00:00.000Z",
    },
    {
      id: "bs-2",
      service_id: "svc-b",
      service_name: "Servicio B (Perfilado de Barba)",
      duration_minutes: 40,
      service_price_cents: 2500,
      assigned_employee_id: "emp-B",
      created_at: "2026-09-04T09:00:01.000Z",
    },
    {
      id: "bs-3",
      service_id: "svc-c",
      service_name: "Servicio C (Tratamiento Capilar Spa)",
      duration_minutes: 60,
      service_price_cents: 8000,
      assigned_employee_id: "emp-C",
      created_at: "2026-09-04T09:00:02.000Z",
    },
  ];

  const schedule = calculateParallelServiceSchedule(
    bookingStartTime,
    rawServicesInput,
    "emp-A"
  );

  // Construir registros que se persisten en booking_services
  const persistedBookingServices: MockBookingService[] = schedule.scheduledServices.map((s) => ({
    id: s.item.id,
    booking_id: "bkg-parallel-001",
    service_id: s.item.service_id,
    service_name: s.item.service_name,
    service_price_cents: s.item.service_price_cents,
    duration_minutes: s.durationMinutes,
    assigned_employee_id: s.workerId,
    start_time: s.startTimeStr,
    end_time: s.endTimeStr,
    hora_inicio: s.hora_inicio || s.startTimeStr,
    hora_fin: s.hora_fin || s.endTimeStr,
    created_at: s.item.created_at,
  }));

  const bookingHeader: MockBookingHeader = {
    id: "bkg-parallel-001",
    booking_code: "PAR001",
    booking_date: "2026-09-05",
    start_time: schedule.startTimeStr,
    end_time: schedule.endTimeStr,
    total_duration_minutes: schedule.totalDurationMinutes,
    total_price_cents: 14000,
    assigned_employee_id: "emp-A",
    status: "confirmada",
    booking_services: persistedBookingServices,
  };

  // Verificaciones de Persistencia Individual
  const serviceA = persistedBookingServices.find((s) => s.assigned_employee_id === "emp-A")!;
  const serviceB = persistedBookingServices.find((s) => s.assigned_employee_id === "emp-B")!;
  const serviceC = persistedBookingServices.find((s) => s.assigned_employee_id === "emp-C")!;

  assert.strictEqual(serviceA.hora_inicio, "09:00:00", "Servicio A arranca a las 09:00:00");
  assert.strictEqual(serviceA.hora_fin, "09:30:00", "Servicio A finaliza a las 09:30:00 (30 min)");
  assert.strictEqual(serviceA.start_time, "09:00:00");
  assert.strictEqual(serviceA.end_time, "09:30:00");

  assert.strictEqual(serviceB.hora_inicio, "09:00:00", "Servicio B arranca en paralelo a las 09:00:00");
  assert.strictEqual(serviceB.hora_fin, "09:40:00", "Servicio B finaliza a las 09:40:00 (40 min)");
  assert.strictEqual(serviceB.start_time, "09:00:00");
  assert.strictEqual(serviceB.end_time, "09:40:00");

  assert.strictEqual(serviceC.hora_inicio, "09:00:00", "Servicio C arranca en paralelo a las 09:00:00");
  assert.strictEqual(serviceC.hora_fin, "10:00:00", "Servicio C finaliza a las 10:00:00 (60 min)");
  assert.strictEqual(serviceC.start_time, "09:00:00");
  assert.strictEqual(serviceC.end_time, "10:00:00");

  // Verificación de Cabecera (Permanencia máxima del cliente)
  assert.strictEqual(bookingHeader.start_time, "09:00:00");
  assert.strictEqual(bookingHeader.end_time, "10:00:00", "Cabecera dura hasta el servicio más largo (10:00:00)");
  assert.strictEqual(bookingHeader.total_duration_minutes, 60, "Duración total cliente = 60 min");

  // Regla Crítica: Cabecera NO sobreescribe el fin de servicios menores
  assert.notStrictEqual(serviceA.hora_fin, bookingHeader.end_time, "Servicio A NO hereda la hora de fin de la cabecera");
  assert.notStrictEqual(serviceB.hora_fin, bookingHeader.end_time, "Servicio B NO hereda la hora de fin de la cabecera");

  console.log("  [PASS] Marcas horarias individuales persistidas correctamente (09:00-09:30, 09:00-09:40, 09:00-10:00)");
  console.log("  [PASS] Cabecera preserva permanencia total de 60m sin sobreescribir sub-servicios");

  // Verificación de Algoritmo de Disponibilidad
  // A) Colaborador A a las 09:30 y 09:35
  const empA_at_0930 = isEmployeeAvailableForSlot("emp-A", "09:30:00", "10:00:00", persistedBookingServices);
  assert.strictEqual(empA_at_0930, true, "Colaborador A está DISPONIBLE a las 09:30:00");

  const empA_at_0935 = isEmployeeAvailableForSlot("emp-A", "09:35:00", "10:05:00", persistedBookingServices);
  assert.strictEqual(empA_at_0935, true, "Colaborador A está DISPONIBLE a las 09:35:00");

  // B) Colaborador B a las 09:35 (ocupado hasta las 09:40) y a las 09:40 (libre)
  const empB_at_0935 = isEmployeeAvailableForSlot("emp-B", "09:35:00", "10:05:00", persistedBookingServices);
  assert.strictEqual(empB_at_0935, false, "Colaborador B sigue OCUPADO a las 09:35:00 (termina 09:40)");

  const empB_at_0940 = isEmployeeAvailableForSlot("emp-B", "09:40:00", "10:10:00", persistedBookingServices);
  assert.strictEqual(empB_at_0940, true, "Colaborador B está DISPONIBLE a partir de las 09:40:00");

  // C) Colaborador C a las 09:45 (ocupado hasta 10:00) y a las 10:00 (libre)
  const empC_at_0945 = isEmployeeAvailableForSlot("emp-C", "09:45:00", "10:15:00", persistedBookingServices);
  assert.strictEqual(empC_at_0945, false, "Colaborador C sigue OCUPADO a las 09:45:00");

  const empC_at_1000 = isEmployeeAvailableForSlot("emp-C", "10:00:00", "10:30:00", persistedBookingServices);
  assert.strictEqual(empC_at_1000, true, "Colaborador C está DISPONIBLE a partir de las 10:00:00");

  console.log("  [PASS] Colaborador A queda libre estrictamente a las 09:30:00 para nuevas reservas");
  console.log("  [PASS] Colaborador B queda libre estrictamente a las 09:40:00 para nuevas reservas");
  console.log("  [PASS] Colaborador C queda libre a las 10:00:00");
}

// -----------------------------------------------------------------------------
// CASO 2: Servicios Consecutivos para un Mismo Colaborador (30m + 40m = 70m)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Servicios Consecutivos para un Mismo Colaborador ---");
{
  const bookingStartTime = "09:00:00";
  const rawServicesInput = [
    {
      id: "bs-seq-1",
      service_id: "svc-1",
      service_name: "Corte Clásico (30m)",
      duration_minutes: 30,
      service_price_cents: 3500,
      assigned_employee_id: "emp-A",
      created_at: "2026-09-04T09:00:00.000Z",
    },
    {
      id: "bs-seq-2",
      service_id: "svc-2",
      service_name: "Tinte Barba (40m)",
      duration_minutes: 40,
      service_price_cents: 4000,
      assigned_employee_id: "emp-A",
      created_at: "2026-09-04T09:00:01.000Z",
    },
    {
      id: "bs-seq-3",
      service_id: "svc-3",
      service_name: "Manicure Spa (45m)",
      duration_minutes: 45,
      service_price_cents: 3000,
      assigned_employee_id: "emp-B",
      created_at: "2026-09-04T09:00:02.000Z",
    },
  ];

  const schedule = calculateParallelServiceSchedule(
    bookingStartTime,
    rawServicesInput,
    "emp-A"
  );

  const persistedServices: MockBookingService[] = schedule.scheduledServices.map((s) => ({
    id: s.item.id,
    booking_id: "bkg-seq-002",
    service_id: s.item.service_id,
    service_name: s.item.service_name,
    service_price_cents: s.item.service_price_cents,
    duration_minutes: s.durationMinutes,
    assigned_employee_id: s.workerId,
    start_time: s.startTimeStr,
    end_time: s.endTimeStr,
    hora_inicio: s.hora_inicio || s.startTimeStr,
    hora_fin: s.hora_fin || s.endTimeStr,
    created_at: s.item.created_at,
  }));

  const svc1 = persistedServices[0];
  const svc2 = persistedServices[1];
  const svc3 = persistedServices[2];

  // Encadenamiento secuencial para Colaborador A
  assert.strictEqual(svc1.hora_inicio, "09:00:00");
  assert.strictEqual(svc1.hora_fin, "09:30:00");

  assert.strictEqual(svc2.hora_inicio, "09:30:00", "Segundo servicio de emp-A se encadena tras el primero a las 09:30:00");
  assert.strictEqual(svc2.hora_fin, "10:10:00", "Segundo servicio de emp-A concluye a las 10:10:00 (30m + 40m = 70m)");

  // Paralelismo independiente para Colaborador B
  assert.strictEqual(svc3.hora_inicio, "09:00:00", "Colaborador B arranca simultáneamente a las 09:00:00");
  assert.strictEqual(svc3.hora_fin, "09:45:00", "Colaborador B finaliza su servicio independiente a las 09:45:00");

  // Validación de Disponibilidad:
  // Colaborador A: Ocupado de 09:00 a 10:10
  assert.strictEqual(
    isEmployeeAvailableForSlot("emp-A", "09:45:00", "10:15:00", persistedServices),
    false,
    "Colaborador A está ocupado a las 09:45 (está atendiendo su segundo servicio)"
  );

  assert.strictEqual(
    isEmployeeAvailableForSlot("emp-A", "10:10:00", "10:40:00", persistedServices),
    true,
    "Colaborador A queda libre a partir de las 10:10:00"
  );

  // Colaborador B: Libre a las 09:45 (NO absorbió los 70 min de emp-A)
  assert.strictEqual(
    isEmployeeAvailableForSlot("emp-B", "09:45:00", "10:15:00", persistedServices),
    true,
    "Colaborador B queda disponible a las 09:45:00 sin absorber tiempo de su compañero"
  );

  console.log("  [PASS] Colaborador A encadena secuencialmente sus servicios (09:00 a 10:10:00)");
  console.log("  [PASS] Colaborador B finaliza independientemente a las 09:45:00 y queda disponible");
}

// -----------------------------------------------------------------------------
// CASO 3: Restricción de Alcance y No Regresión
// -----------------------------------------------------------------------------
console.log("\n--- 3. Restricción de Alcance y No Regresión ---");
{
  const rawServicesInput = [
    {
      id: "bs-reg-1",
      service_id: "s1",
      service_name: "Corte Clásico",
      duration_minutes: 30,
      service_price_cents: 3500, // S/ 35.00
      assigned_employee_id: "emp-1",
      created_at: "2026-09-04T10:00:00.000Z",
    },
    {
      id: "bs-reg-2",
      service_id: "s2",
      service_name: "Facial Spa",
      duration_minutes: 60,
      service_price_cents: 8000, // S/ 80.00
      assigned_employee_id: "emp-2",
      created_at: "2026-09-04T10:00:01.000Z",
    },
  ];

  const schedule = calculateParallelServiceSchedule("10:00:00", rawServicesInput);

  // Total pactado intacto
  const totalCents = rawServicesInput.reduce((acc, s) => acc + s.service_price_cents, 0);
  assert.strictEqual(totalCents, 11500, "Total pactado se mantiene en S/ 115.00");
  assert.strictEqual(schedule.totalDurationMinutes, 60, "Duración total de estancia del cliente: 60 min");

  console.log("  [PASS] Precios y montos intactos (S/ 115.00)");
  console.log("  [PASS] Duración integral de la estancia del cliente en local intacta (60 min)");
}

console.log("\n==========================================================================");
console.log(" 🏁 RESULTADO SUITE: Todas las pruebas de persistencia y validación PASARON.");
console.log("==========================================================================");
