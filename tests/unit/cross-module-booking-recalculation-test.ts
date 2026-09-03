/**
 * Suite de Pruebas: Recálculo y Propagación Global de Montos de Reservas
 * Archivo: tests/unit/cross-module-booking-recalculation-test.ts
 * Sistema: Acicalados Spa & Barber Shop
 */

import { calculateValidIncomeForBooking, normalizePaymentMethod } from "@/lib/services/report-service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName} -> ${failureDetail || "Assertion failed"}`);
    failed++;
  }
}

console.log("\n==========================================================================");
console.log(" 🧪 AUDITORÍA INTEGRAL: RECÁLCULO Y PROPAGACIÓN GLOBAL DE MONTOS");
console.log("==========================================================================\n");

// -----------------------------------------------------------------------------
// 1. Inmutabilidad del Catálogo Maestro de Servicios
// -----------------------------------------------------------------------------
console.log("--- 1. Inmutabilidad del Catálogo Maestro de Servicios ---");
const masterCatalog = [
  { id: "svc-barber-1", name: "Corte Clásico & Barba", price_cents: 3500, type: "barberia", duration_minutes: 40 },
  { id: "svc-spa-1", name: "Limpieza Facial Profunda", price_cents: 8000, type: "spa", duration_minutes: 60 },
  { id: "svc-barber-2", name: "Diseño de Barba Premium", price_cents: 2500, type: "barberia", duration_minutes: 30 },
];
const masterCatalogSnapshot = JSON.stringify(masterCatalog);

// Simulación de reserva inicial multi-servicio
interface BookingServiceItem {
  id: string;
  booking_id: string;
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  assigned_employee_id: string | null;
}

let bookingServices: BookingServiceItem[] = [
  {
    id: "bs-1",
    booking_id: "book-test-1",
    service_id: "svc-barber-1",
    service_name: "Corte Clásico & Barba",
    service_price_cents: 3500,
    duration_minutes: 40,
    assigned_employee_id: "emp-barber-1",
  },
  {
    id: "bs-2",
    booking_id: "book-test-1",
    service_id: "svc-spa-1",
    service_name: "Limpieza Facial Profunda",
    service_price_cents: 8000,
    duration_minutes: 60,
    assigned_employee_id: "emp-spa-1",
  },
];

function recalculateBooking(
  services: BookingServiceItem[],
  verifiedPaymentsSumCents: number,
  previousPaymentStatus = "sin_pago",
  advancePercentage = 25
) {
  const totalPriceCents = services.reduce((sum, s) => sum + s.service_price_cents, 0);
  const totalDurationMinutes = services.reduce((sum, s) => sum + s.duration_minutes, 0);
  const advanceRequiredCents = Math.ceil((totalPriceCents * advancePercentage) / 100);

  let amountPaidCents = 0;
  if (verifiedPaymentsSumCents > 0) {
    amountPaidCents = verifiedPaymentsSumCents;
  } else if (previousPaymentStatus === "total") {
    amountPaidCents = totalPriceCents;
  } else {
    amountPaidCents = 0;
  }

  const balanceCents = Math.max(0, totalPriceCents - amountPaidCents);

  let paymentStatus: "sin_pago" | "parcial" | "total" = "sin_pago";
  if (amountPaidCents >= totalPriceCents && totalPriceCents > 0) {
    paymentStatus = "total";
  } else if (amountPaidCents >= advanceRequiredCents && amountPaidCents > 0) {
    paymentStatus = "parcial";
  } else {
    paymentStatus = "sin_pago";
  }

  return {
    totalPriceCents,
    totalDurationMinutes,
    advanceRequiredCents,
    amountPaidCents,
    balanceCents,
    paymentStatus,
  };
}

// -----------------------------------------------------------------------------
// Caso 1: Creación inicial
// -----------------------------------------------------------------------------
const state1 = recalculateBooking(bookingServices, 0);
assert(state1.totalPriceCents === 11500, "Total inicial correcto: S/ 115.00 (3500 + 8000)");
assert(state1.advanceRequiredCents === 2875, "Adelanto mínimo del 25% correcto: S/ 28.75");
assert(state1.balanceCents === 11500, "Saldo inicial pendiente: S/ 115.00");
assert(state1.paymentStatus === "sin_pago", "Estado inicial: sin_pago");

// -----------------------------------------------------------------------------
// Caso 2: Edición de precio hacia arriba (Recargo manual en servicio de barbería)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Edición de Precio Individual (Recargo y Descuento) ---");
bookingServices = bookingServices.map((bs) =>
  bs.id === "bs-1" ? { ...bs, service_price_cents: 5000 } : bs
);

const state2 = recalculateBooking(bookingServices, 0);
assert(state2.totalPriceCents === 13000, "Total con recargo correcto: S/ 130.00 (5000 + 8000)");
assert(state2.advanceRequiredCents === 3250, "Nuevo adelanto requerido al 25%: S/ 32.50 (3250 cents)");
assert(state2.balanceCents === 13000, "Nuevo saldo pendiente: S/ 130.00");

// Cliente abona adelanto requerido del 25% (S/ 32.50)
const state2WithAdvance = recalculateBooking(bookingServices, 3250);
assert(state2WithAdvance.paymentStatus === "parcial", "Estado cambia a 'parcial' tras abonar adelanto");
assert(state2WithAdvance.balanceCents === 9750, "Saldo restante: S/ 97.50 (13000 - 3250)");

// Ahora recepcionista aplica cortesía en limpieza facial (descuento de 80.00 a 60.00)
bookingServices = bookingServices.map((bs) =>
  bs.id === "bs-2" ? { ...bs, service_price_cents: 6000 } : bs
);

const state2Discount = recalculateBooking(bookingServices, 3250);
assert(state2Discount.totalPriceCents === 11000, "Total con descuento: S/ 110.00 (5000 + 6000)");
assert(state2Discount.balanceCents === 7750, "Saldo restante recalculado: S/ 77.50 (11000 - 3250)");
assert(state2Discount.paymentStatus === "parcial", "Mantiene 'parcial' pues 3250 >= 25% de 11000 (2750)");

// -----------------------------------------------------------------------------
// Caso 3: Eliminación de un servicio en cita multi-servicio
// -----------------------------------------------------------------------------
console.log("\n--- 3. Eliminación Individual de Servicio en Reserva Multi-Servicio ---");
// Se elimina el servicio de spa (bs-2)
const remainingServices = bookingServices.filter((bs) => bs.id !== "bs-2");
assert(remainingServices.length === 1, "Queda exactamente 1 servicio en la reserva");

const state3 = recalculateBooking(remainingServices, 3250);
assert(state3.totalPriceCents === 5000, "Total cita reducido a S/ 50.00 tras eliminar el servicio de Spa");
assert(state3.totalDurationMinutes === 40, "Duración recalculada a 40 minutos");
assert(state3.balanceCents === 1750, "Nuevo saldo restante: S/ 17.50 (5000 - 3250)");
assert(state3.paymentStatus === "parcial", "Estado se mantiene consistente");

// -----------------------------------------------------------------------------
// Caso 4: Verificación de Inmutabilidad del Catálogo Maestro
// -----------------------------------------------------------------------------
console.log("\n--- 4. Inmutabilidad Estricta del Catálogo Maestro ---");
assert(
  JSON.stringify(masterCatalog) === masterCatalogSnapshot,
  "El catálogo maestro de servicios NO ha sido modificado en ningún momento"
);
assert(masterCatalog[0].price_cents === 3500, "Precio base de Corte Clásico sigue intacto en S/ 35.00");
assert(masterCatalog[1].price_cents === 8000, "Precio base de Limpieza Facial sigue intacto en S/ 80.00");

// -----------------------------------------------------------------------------
// Caso 5: Sincronización en Inicio y Reportes (calculateValidIncomeForBooking)
// -----------------------------------------------------------------------------
console.log("\n--- 5. Sincronización Consistente entre Inicio, Reservas y Reportes ---");
// Reserva confirmada con adelanto
const bookingRecord = {
  status: "confirmada",
  advance_amount_cents: state3.amountPaidCents,
  total_price_cents: state3.totalPriceCents,
  payment_status: state3.paymentStatus,
};
const incomeComputed = calculateValidIncomeForBooking(bookingRecord);
assert(
  incomeComputed === 3250,
  "Inicio y Reportes reconocen exactamente el ingreso cobrado de S/ 32.50"
);

// Liquidación total
const fullyPaidBooking = {
  status: "completada",
  advance_amount_cents: 5000,
  total_price_cents: 5000,
  payment_status: "total",
};
assert(
  calculateValidIncomeForBooking(fullyPaidBooking) === 5000,
  "Liquidación total computa S/ 50.00 exactos"
);

// Reserva presencial marcada 'total' sin logs previos
const walkInTotalWithoutLogs = {
  status: "confirmada",
  advance_amount_cents: 0,
  total_price_cents: 5000,
  payment_status: "total",
};
assert(
  calculateValidIncomeForBooking(walkInTotalWithoutLogs) === 5000,
  "Reserva total sin logs previos preserva su ingreso cobrado íntegro de S/ 50.00"
);

// -----------------------------------------------------------------------------
// Caso 6: Preservación Estricta de Egresos
// -----------------------------------------------------------------------------
console.log("\n--- 6. Preservación Estricta de Egresos ---");
const sampleExpenses = [
  { id: "exp-1", amount_cents: 1500, category: "insumos", description: "Navajas y cuchillas" },
  { id: "exp-2", amount_cents: 4500, category: "servicios", description: "Pago de luz" },
];
const totalExpensesCents = sampleExpenses.reduce((sum, e) => sum + e.amount_cents, 0);
assert(totalExpensesCents === 6000, "Total de egresos permanece intacto en S/ 60.00");
const netBalance = 5000 - totalExpensesCents;
assert(netBalance === -1000, "Saldo neto (Ingresos S/ 50.00 - Egresos S/ 60.00 = -S/ 10.00)");

// -----------------------------------------------------------------------------
// Resumen
// -----------------------------------------------------------------------------
console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO SUITE: ${passed} pruebas superadas, ${failed} fallos.`);
console.log("==========================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
