/**
 * Suite de Pruebas: Edición de Precio por Servicio en Reserva e Inmutabilidad del Catálogo
 * Archivo: tests/unit/service-price-edit-audit-test.ts
 * Sistema: Acicalados Spa & Barber Shop
 */

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
console.log(" 🧪 AUDITORÍA: EDICIÓN DE PRECIO POR SERVICIO, TOTALES E INMUTABILIDAD");
console.log("==========================================================================\n");

// -----------------------------------------------------------------------------
// 1. Simulación de Catálogo Maestro y Reserva
// -----------------------------------------------------------------------------
console.log("--- 1. Inmutabilidad del Catálogo Maestro de Servicios ---");

const masterCatalog = [
  { id: "svc-1", name: "Corte Clásico & Barba", price_cents: 3500, type: "barberia" },
  { id: "svc-2", name: "Limpieza Facial Profunda", price_cents: 8000, type: "spa" },
  { id: "svc-3", name: "Masaje Relajante", price_cents: 6000, type: "spa" },
];

// Snapshot inmutable inicial
const initialCatalogSnapshot = JSON.parse(JSON.stringify(masterCatalog));

// Una reserva creada basada en el catálogo
let bookingServiceItems = [
  { id: "bs-1", booking_id: "book-101", service_id: "svc-1", service_name: "Corte Clásico & Barba", service_price_cents: 3500 },
  { id: "bs-2", booking_id: "book-101", service_id: "svc-2", service_name: "Limpieza Facial Profunda", service_price_cents: 8000 },
];

function calculateBookingTotals(items: typeof bookingServiceItems, paymentsPaidCents: number, advancePct = 25) {
  const totalPriceCents = items.reduce((sum, item) => sum + item.service_price_cents, 0);
  const advanceRequiredCents = Math.ceil((totalPriceCents * advancePct) / 100);
  const balanceCents = Math.max(0, totalPriceCents - paymentsPaidCents);

  let paymentStatus: "sin_pago" | "parcial" | "total" = "sin_pago";
  if (paymentsPaidCents >= totalPriceCents && totalPriceCents > 0) {
    paymentStatus = "total";
  } else if (paymentsPaidCents >= advanceRequiredCents && paymentsPaidCents > 0) {
    paymentStatus = "parcial";
  } else if (paymentsPaidCents > 0) {
    paymentStatus = "sin_pago";
  }

  return {
    totalPriceCents,
    advanceRequiredCents,
    balanceCents,
    paymentStatus,
    amountPaidCents: paymentsPaidCents,
  };
}

// -----------------------------------------------------------------------------
// Caso 1: Precio original de la reserva
// -----------------------------------------------------------------------------
const initialTotals = calculateBookingTotals(bookingServiceItems, 0);
assert(initialTotals.totalPriceCents === 11500, "Total inicial correcto (S/ 115.00)");
assert(initialTotals.advanceRequiredCents === 2875, "Adelanto mínimo del 25% correcto (S/ 28.75)");
assert(initialTotals.balanceCents === 11500, "Saldo inicial pendiente total");
assert(initialTotals.paymentStatus === "sin_pago", "Estado inicial sin pago");

// -----------------------------------------------------------------------------
// Caso 2: Edición manual de precio en un servicio de la reserva (Recargo / Descuento)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Ajuste manual de precio en servicio individual ---");

// Recepcionista ajusta el Corte Clásico de S/ 35.00 a S/ 45.00 por diseño especial
bookingServiceItems = bookingServiceItems.map((bs) =>
  bs.id === "bs-1" ? { ...bs, service_price_cents: 4500 } : bs
);

const updatedTotals1 = calculateBookingTotals(bookingServiceItems, 0);
assert(updatedTotals1.totalPriceCents === 12500, "Total recalculado con recargo: S/ 125.00 (4500 + 8000)");
assert(updatedTotals1.advanceRequiredCents === 3125, "Nuevo adelanto requerido 25%: S/ 31.25 (3125 cents)");
assert(updatedTotals1.balanceCents === 12500, "Nuevo saldo actualizado a S/ 125.00");

// -----------------------------------------------------------------------------
// Caso 3: Verificación estricta de Inmutabilidad del Catálogo Maestro
// -----------------------------------------------------------------------------
console.log("\n--- 3. Verificación de Inmutabilidad del Catálogo Maestro ---");
const masterSvc1 = masterCatalog.find((s) => s.id === "svc-1");
assert(masterSvc1?.price_cents === 3500, "Precio en catálogo maestro sigue intacto en S/ 35.00 (3500 cents)");
assert(JSON.stringify(masterCatalog) === JSON.stringify(initialCatalogSnapshot), "El catálogo maestro completo NO sufrió alteraciones");

// -----------------------------------------------------------------------------
// Caso 4: Recálculo con pagos verificados existentes (Pago de adelanto)
// -----------------------------------------------------------------------------
console.log("\n--- 4. Sincronización con pagos verificados y saldos ---");
const paidAdvance = 3125; // Pagó S/ 31.25
const totalsWithPayment = calculateBookingTotals(bookingServiceItems, paidAdvance);
assert(totalsWithPayment.paymentStatus === "parcial", "Estado de pago es 'parcial' con adelanto exacto");
assert(totalsWithPayment.balanceCents === 9375, "Saldo restante: S/ 93.75 (125.00 - 31.25)");

// Ahora recepcionista aplica un descuento de cortesía en la limpieza facial (de 80.00 a 60.00)
bookingServiceItems = bookingServiceItems.map((bs) =>
  bs.id === "bs-2" ? { ...bs, service_price_cents: 6000 } : bs
);

const totalsAfterDiscount = calculateBookingTotals(bookingServiceItems, paidAdvance);
assert(totalsAfterDiscount.totalPriceCents === 10500, "Nuevo total cita con descuento: S/ 105.00 (45.00 + 60.00)");
assert(totalsAfterDiscount.balanceCents === 7375, "Nuevo saldo restante recalculado: S/ 73.75 (105.00 - 31.25)");
assert(totalsAfterDiscount.paymentStatus === "parcial", "Mantiene estado 'parcial' ya que 31.25 >= 25% de 105.00 (26.25)");

// -----------------------------------------------------------------------------
// Caso 5: Pago completado
// -----------------------------------------------------------------------------
const paidTotal = 10500;
const totalsPaidInFull = calculateBookingTotals(bookingServiceItems, paidTotal);
assert(totalsPaidInFull.balanceCents === 0, "Saldo en cero al pagar total");
assert(totalsPaidInFull.paymentStatus === "total", "Estado de pago es 'total'");

// -----------------------------------------------------------------------------
// Caso 6: Formato de Leyenda Referencial en Vista Pública
// -----------------------------------------------------------------------------
console.log("\n--- 5. Formato de Leyenda Referencial en Vista Pública ---");
function formatPublicPrice(priceCents: number): string {
  return `Precio referencial desde S/ ${(priceCents / 100).toFixed(2)}`;
}

assert(
  formatPublicPrice(3500) === "Precio referencial desde S/ 35.00",
  "Formato público correcto para Barbería: 'Precio referencial desde S/ 35.00'"
);
assert(
  formatPublicPrice(8000) === "Precio referencial desde S/ 80.00",
  "Formato público correcto para Spa: 'Precio referencial desde S/ 80.00'"
);

// -----------------------------------------------------------------------------
// Resumen
// -----------------------------------------------------------------------------
console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO: ${passed} pasadas, ${failed} falladas.`);
console.log("==========================================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
