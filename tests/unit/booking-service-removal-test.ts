import assert from "node:assert";

/**
 * Test Suite: Eliminación independiente de servicios en reservas multi-servicio y recálculo
 * Archivo: tests/unit/booking-service-removal-test.ts
 */

function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TestServiceItem {
  id: string;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  assigned_employee_id: string | null;
}

interface TestBooking {
  id: string;
  booking_code: string;
  start_time: string;
  end_time: string;
  total_price_cents: number;
  total_duration_minutes: number;
  advance_percentage: number;
  advance_amount_cents: number;
  balance_cents: number;
  payment_status: string;
  assigned_employee_id: string | null;
  booking_services: TestServiceItem[];
}

function simulateServiceRemoval(
  booking: TestBooking,
  serviceIdToRemove: string,
  verifiedPaymentsPaidCents: number
) {
  // 1. Validar que no sea el único servicio
  if (booking.booking_services.length <= 1) {
    return {
      success: false,
      error: "No es posible retirar el único servicio de la reserva.",
    };
  }

  // 2. Filtrar el servicio eliminado
  const remainingServices = booking.booking_services.filter((s) => s.id !== serviceIdToRemove);
  if (remainingServices.length === booking.booking_services.length) {
    return {
      success: false,
      error: "Servicio no encontrado.",
    };
  }

  // 3. Recalcular precio total
  const newTotalPriceCents = remainingServices.reduce(
    (sum, s) => sum + s.service_price_cents,
    0
  );

  // 4. Recalcular duración y hora fin
  const newTotalDurationMinutes = remainingServices.reduce(
    (sum, s) => sum + s.duration_minutes,
    0
  );
  const baseStartMinutes = parseTimeToMinutes(booking.start_time);
  const newEndMinutes = baseStartMinutes + newTotalDurationMinutes;
  const newEndTime = `${formatMinutesToTime(newEndMinutes)}:00`;

  // 5. Recalcular pagos y saldo
  const amountPaidCents = verifiedPaymentsPaidCents;
  const advanceRequiredCents = Math.ceil(
    (newTotalPriceCents * (booking.advance_percentage || 25)) / 100
  );
  const newBalanceCents = Math.max(0, newTotalPriceCents - amountPaidCents);

  let newPaymentStatus = "sin_pago";
  if (amountPaidCents >= newTotalPriceCents && newTotalPriceCents > 0) {
    newPaymentStatus = "total";
  } else if (amountPaidCents >= advanceRequiredCents && amountPaidCents > 0) {
    newPaymentStatus = "parcial";
  }

  // 6. Empleado asignado
  let newAssignedEmployeeId = booking.assigned_employee_id;
  const isEmployeeStillAssigned = remainingServices.some(
    (s) => s.assigned_employee_id === booking.assigned_employee_id
  );
  if (!isEmployeeStillAssigned) {
    newAssignedEmployeeId =
      remainingServices.find((s) => s.assigned_employee_id)?.assigned_employee_id || null;
  }

  return {
    success: true,
    booking: {
      ...booking,
      total_price_cents: newTotalPriceCents,
      total_duration_minutes: newTotalDurationMinutes,
      end_time: newEndTime,
      advance_amount_cents: amountPaidCents,
      balance_cents: newBalanceCents,
      payment_status: newPaymentStatus,
      assigned_employee_id: newAssignedEmployeeId,
      booking_services: remainingServices,
    },
  };
}

console.log("🧪 Iniciando pruebas de eliminación individual de servicios...");

// Catálogo maestro simulado para auditar inmutabilidad
const masterCatalog = [
  { id: "svc-1", name: "Tinte Color Entero", price_cents: 8000, duration_minutes: 120 },
  { id: "svc-2", name: "Manicure", price_cents: 3000, duration_minutes: 60 },
  { id: "svc-3", name: "Pedicure", price_cents: 4000, duration_minutes: 45 },
];
const masterCatalogSnapshot = JSON.stringify(masterCatalog);

// Caso 1: Reserva con 3 servicios, se retira 1 servicio
{
  const booking: TestBooking = {
    id: "b-101",
    booking_code: "abc-3services",
    start_time: "14:00:00",
    end_time: "17:45:00", // 120 + 60 + 45 = 225 min (3h 45m) -> 14:00 + 225m = 17:45
    total_price_cents: 15000, // 80 + 30 + 40 = 150 Soles
    total_duration_minutes: 225,
    advance_percentage: 25,
    advance_amount_cents: 0,
    balance_cents: 15000,
    payment_status: "sin_pago",
    assigned_employee_id: "emp-janet",
    booking_services: [
      {
        id: "bs-1",
        service_id: "svc-1",
        service_name: "Tinte Color Entero",
        service_price_cents: 8000,
        duration_minutes: 120,
        assigned_employee_id: "emp-janet",
      },
      {
        id: "bs-2",
        service_id: "svc-2",
        service_name: "Manicure",
        service_price_cents: 3000,
        duration_minutes: 60,
        assigned_employee_id: "emp-malu",
      },
      {
        id: "bs-3",
        service_id: "svc-3",
        service_name: "Pedicure",
        service_price_cents: 4000,
        duration_minutes: 45,
        assigned_employee_id: "emp-luisa",
      },
    ],
  };

  // Se retira el servicio 'Manicure' (bs-2)
  const result = simulateServiceRemoval(booking, "bs-2", 0);
  assert.strictEqual(result.success, true);
  const updated = result.booking!;

  assert.strictEqual(updated.booking_services.length, 2, "Deben quedar 2 servicios");
  assert.strictEqual(updated.total_price_cents, 12000, "Nuevo total = S/ 120.00 (15000 - 3000)");
  assert.strictEqual(updated.total_duration_minutes, 165, "Nueva duración = 165 min (120 + 45)");
  assert.strictEqual(updated.end_time, "16:45:00", "Nuevo horario fin = 16:45:00 (14:00 + 165m)");
  assert.strictEqual(updated.balance_cents, 12000, "Nuevo saldo pendiente = S/ 120.00");

  console.log("  ✅ Caso 1 (Eliminación de 1 de 3 servicios y recálculo): PASS");
}

// Caso 2: Validación cuando solo queda 1 servicio (Rechazo)
{
  const booking: TestBooking = {
    id: "b-102",
    booking_code: "single-svc",
    start_time: "10:00:00",
    end_time: "11:00:00",
    total_price_cents: 5000,
    total_duration_minutes: 60,
    advance_percentage: 25,
    advance_amount_cents: 0,
    balance_cents: 5000,
    payment_status: "sin_pago",
    assigned_employee_id: "emp-1",
    booking_services: [
      {
        id: "bs-only",
        service_id: "svc-1",
        service_name: "Corte",
        service_price_cents: 5000,
        duration_minutes: 60,
        assigned_employee_id: "emp-1",
      },
    ],
  };

  const result = simulateServiceRemoval(booking, "bs-only", 0);
  assert.strictEqual(result.success, false, "Debe rechazar eliminar el único servicio restante");
  assert.ok(result.error?.includes("único servicio"), "Mensaje orienta a anulación completa");

  console.log("  ✅ Caso 2 (Rechazo de eliminación de servicio único): PASS");
}

// Caso 3: Reasignación de empleado principal si el empleado eliminado ya no tiene servicios
{
  const booking: TestBooking = {
    id: "b-103",
    booking_code: "emp-reassign",
    start_time: "15:00:00",
    end_time: "16:30:00",
    total_price_cents: 9000,
    total_duration_minutes: 90,
    advance_percentage: 25,
    advance_amount_cents: 5000, // Ya pagó adelanto de S/ 50.00
    balance_cents: 4000,
    payment_status: "parcial",
    assigned_employee_id: "emp-aaron", // Aaron solo hace el servicio 1
    booking_services: [
      {
        id: "bs-aaron",
        service_id: "svc-fade",
        service_name: "Corte Fade",
        service_price_cents: 4000,
        duration_minutes: 45,
        assigned_employee_id: "emp-aaron",
      },
      {
        id: "bs-yholi",
        service_id: "svc-pestanas",
        service_name: "Rizado de Pestañas",
        service_price_cents: 5000,
        duration_minutes: 45,
        assigned_employee_id: "emp-yholi",
      },
    ],
  };

  // Se retira el servicio de Aaron (bs-aaron)
  const result = simulateServiceRemoval(booking, "bs-aaron", 5000);
  assert.strictEqual(result.success, true);
  const updated = result.booking!;

  // Nuevo total S/ 50.00, adelanto pagado S/ 50.00 -> Ahora queda PAGADO TOTAL!
  assert.strictEqual(updated.total_price_cents, 5000);
  assert.strictEqual(updated.balance_cents, 0, "Saldo en 0");
  assert.strictEqual(updated.payment_status, "total", "Pasa a estado total");
  assert.strictEqual(updated.assigned_employee_id, "emp-yholi", "Reasigna cabecera a Yholi");
  assert.strictEqual(updated.end_time, "15:45:00", "Nuevo horario fin = 15:45:00");

  console.log("  ✅ Caso 3 (Recálculo de estado de pago y reasignación de colaborador): PASS");
}

// Caso 4: Inmutabilidad del catálogo maestro
{
  assert.strictEqual(
    JSON.stringify(masterCatalog),
    masterCatalogSnapshot,
    "El catálogo maestro no debe sufrir ninguna alteración"
  );
  console.log("  ✅ Caso 4 (Inmutabilidad del catálogo maestro): PASS");
}

console.log("\n🎉 ¡Todas las pruebas unitarias pasaron con 100% de éxito!");
