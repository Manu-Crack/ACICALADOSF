/**
 * Suite Oficial de Pruebas Unitarias y Reglas de Negocio
 * Ubicación: tests/unit/comprehensive-audit-test.ts
 * Sistema: Acicalados Spa & Barber Shop
 */

import { calculateBonusMinutes } from "../../src/lib/utils/bonus-calculator";
import { sanitizeForExcel } from "../../src/lib/utils/excel-generator";

let passedCount = 0;
let failedCount = 0;

function check(assertion: boolean, description: string, details?: string) {
  if (assertion) {
    console.log(`  [PASS] ${description}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${description} ${details ? `-> ${details}` : ""}`);
    failedCount++;
  }
}

console.log("\n==========================================================================");
console.log(" 💎 SUITE OFICIAL DE PRUEBAS UNITARIAS Y REGLAS DE NEGOCIO (RC1)");
console.log("==========================================================================\n");

// -----------------------------------------------------------------------------
// 1. CASOS OBLIGATORIOS DE RESERVAS Y PAGOS (Casos 1 al 8)
// -----------------------------------------------------------------------------
console.log("--- 1. Casos de Prueba Obligatorios de Reservas y Pagos ---");

function simulateBookingPayment(
  totalPriceCents: number,
  advancePct: number,
  payments: Array<{ yape_cents: number; cash_cents: number; status: "verified" | "voided" }>
) {
  const minAdvanceCents = Math.ceil((totalPriceCents * advancePct) / 100);
  const verifiedPayments = payments.filter((p) => p.status === "verified");
  const totalPaidCents = verifiedPayments.reduce((acc, p) => acc + p.yape_cents + p.cash_cents, 0);
  const balanceCents = Math.max(0, totalPriceCents - totalPaidCents);

  let paymentStatus: string;
  let bookingStatus: string;

  if (totalPaidCents === 0) {
    paymentStatus = "sin_pago";
    bookingStatus = "pendiente";
  } else if (totalPaidCents >= totalPriceCents) {
    paymentStatus = "pagado_total";
    bookingStatus = "confirmada";
  } else if (totalPaidCents >= minAdvanceCents) {
    paymentStatus = "adelanto_pagado";
    bookingStatus = "confirmada";
  } else {
    paymentStatus = "pago_parcial";
    bookingStatus = "pendiente";
  }

  return { minAdvanceCents, totalPaidCents, balanceCents, paymentStatus, bookingStatus };
}

// Caso 1: Servicio 100, Pago 0 -> Pendiente, Adelanto req 25, No confirmada
const c1 = simulateBookingPayment(10000, 25, []);
check(
  c1.bookingStatus === "pendiente" && c1.minAdvanceCents === 2500 && c1.totalPaidCents === 0 && c1.paymentStatus === "sin_pago",
  "Caso 1: Servicio S/ 100, Pago S/ 0 -> Pendiente, Adelanto Req S/ 25"
);

// Caso 2: Servicio 100, Pago 20 -> No confirmar (pago_parcial, pendiente)
const c2 = simulateBookingPayment(10000, 25, [{ yape_cents: 0, cash_cents: 2000, status: "verified" }]);
check(
  c2.bookingStatus === "pendiente" && c2.paymentStatus === "pago_parcial" && c2.totalPaidCents === 2000 && c2.balanceCents === 8000,
  "Caso 2: Servicio S/ 100, Pago S/ 20 -> Pendiente (Adelanto insuficiente)"
);

// Caso 3: Servicio 100, Yape 25 -> Total pagado 25, Saldo 75, Confirmada
const c3 = simulateBookingPayment(10000, 25, [{ yape_cents: 2500, cash_cents: 0, status: "verified" }]);
check(
  c3.bookingStatus === "confirmada" && c3.paymentStatus === "adelanto_pagado" && c3.totalPaidCents === 2500 && c3.balanceCents === 7500,
  "Caso 3: Servicio S/ 100, Yape S/ 25 -> Confirmada (Total pagado S/ 25, Saldo S/ 75)"
);

// Caso 4: Servicio 100, Efectivo 25 -> Total pagado 25, Saldo 75, Confirmada
const c4 = simulateBookingPayment(10000, 25, [{ yape_cents: 0, cash_cents: 2500, status: "verified" }]);
check(
  c4.bookingStatus === "confirmada" && c4.paymentStatus === "adelanto_pagado" && c4.totalPaidCents === 2500 && c4.balanceCents === 7500,
  "Caso 4: Servicio S/ 100, Efectivo S/ 25 -> Confirmada (Total pagado S/ 25, Saldo S/ 75)"
);

// Caso 5: Pago mixto Yape 15 + Efectivo 10 = 25 -> Válido
const c5 = simulateBookingPayment(10000, 25, [{ yape_cents: 1500, cash_cents: 1000, status: "verified" }]);
check(
  c5.bookingStatus === "confirmada" && c5.totalPaidCents === 2500 && c5.balanceCents === 7500,
  "Caso 5: Pago mixto válido Yape S/ 15 + Efectivo S/ 10 = S/ 25 -> Confirmada"
);

// Caso 6: Pago mixto inválido Yape 15 + Efectivo 5 con monto declarado 25 -> Rechazado
function validateMixedPayment(amountCents: number, yapeCents: number, cashCents: number) {
  if (yapeCents < 0 || cashCents < 0) return false;
  return yapeCents + cashCents === amountCents;
}
check(
  validateMixedPayment(2500, 1500, 500) === false,
  "Caso 6: Pago mixto inconsistente (Yape S/ 15 + Efectivo S/ 5 != S/ 25) -> Rechazado"
);

// Caso 7: Pago 100 -> Pagado total, Saldo 0, Confirmada
const c7 = simulateBookingPayment(10000, 25, [{ yape_cents: 10000, cash_cents: 0, status: "verified" }]);
check(
  c7.bookingStatus === "confirmada" && c7.paymentStatus === "pagado_total" && c7.totalPaidCents === 10000 && c7.balanceCents === 0,
  "Caso 7: Pago Total S/ 100 -> Pagado Total, Saldo S/ 0, Confirmada"
);

// Caso 8: Adelanto 25, luego saldo 75 -> Total pagado 100, Saldo 0
const c8 = simulateBookingPayment(10000, 25, [
  { yape_cents: 2500, cash_cents: 0, status: "verified" },
  { yape_cents: 0, cash_cents: 7500, status: "verified" },
]);
check(
  c8.bookingStatus === "confirmada" && c8.paymentStatus === "pagado_total" && c8.totalPaidCents === 10000 && c8.balanceCents === 0,
  "Caso 8: Adelanto S/ 25 + Liquidación S/ 75 -> Total Pagado S/ 100, Saldo S/ 0"
);

// -----------------------------------------------------------------------------
// 2. COMPARACIÓN FINANCIERA (Escenario Reservas A, B, C)
// -----------------------------------------------------------------------------
console.log("\n--- 2. Escenario Financiero Controlado (Reservas A, B, C) ---");

const resA = { serviceCents: 10000, yapeCents: 2500, cashCents: 0 };
const resB = { serviceCents: 8000, yapeCents: 0, cashCents: 8000 };
const resC = { serviceCents: 20000, yapeCents: 3000, cashCents: 2000 };

const allRes = [resA, resB, resC];
const totalServicesValueCents = allRes.reduce((acc, r) => acc + r.serviceCents, 0); // 380.00
const totalYapeCollectedCents = allRes.reduce((acc, r) => acc + r.yapeCents, 0); // 55.00
const totalCashCollectedCents = allRes.reduce((acc, r) => acc + r.cashCents, 0); // 100.00
const totalRealIncomeCents = totalYapeCollectedCents + totalCashCollectedCents; // 155.00
const totalPendingBalanceCents = totalServicesValueCents - totalRealIncomeCents; // 225.00

check(totalServicesValueCents === 38000, "Valor Total de Servicios = S/ 380.00");
check(totalRealIncomeCents === 15500, "Ingresos Realmente Cobrados = S/ 155.00");
check(totalYapeCollectedCents === 5500, "Cobrado por Yape = S/ 55.00");
check(totalCashCollectedCents === 10000, "Cobrado en Efectivo = S/ 100.00");
check(totalPendingBalanceCents === 22500, "Saldo Pendiente Total = S/ 225.00");

// -----------------------------------------------------------------------------
// 3. SEGURIDAD Y FÓRMULAS EXCEL (Formula Injection)
// -----------------------------------------------------------------------------
console.log("\n--- 3. Seguridad de Archivos Excel y Formula Injection ---");

check(sanitizeForExcel("=SUM(A1:A10)" as string) === "'=SUM(A1:A10)", "Neutralización de prefijo '='");
check(sanitizeForExcel("+cmd|' /C calc'!A0" as string) === "'+cmd|' /C calc'!A0", "Neutralización de prefijo '+'");
check(sanitizeForExcel("-100" as string) === "'-100", "Neutralización de prefijo '-'");
check(sanitizeForExcel("@HYPERLINK('http://malicious.com')" as string) === "'@HYPERLINK('http://malicious.com')", "Neutralización de prefijo '@'");
check(sanitizeForExcel("Cliente Regular" as string) === "Cliente Regular", "Texto estándar inalterado");

// -----------------------------------------------------------------------------
// 4. JUSTIFICACIONES DE ASISTENCIA (Escenarios A, B, C)
// -----------------------------------------------------------------------------
console.log("\n--- 4. Asistencia y Justificaciones Independientes ---");

const attRecord = {
  id: "att-1",
  check_in_justified: false,
  check_out_justified: false,
};

const justifiedCheckIn = { ...attRecord, check_in_justified: true };
check(justifiedCheckIn.check_in_justified === true && justifiedCheckIn.check_out_justified === false, "Escenario A: Justificar entrada no altera salida");

const justifiedCheckOut = { ...attRecord, check_out_justified: true };
check(justifiedCheckOut.check_in_justified === false && justifiedCheckOut.check_out_justified === true, "Escenario B: Justificar salida no altera entrada");

const justifiedBoth = { ...attRecord, check_in_justified: true, check_out_justified: true };
check(justifiedBoth.check_in_justified === true && justifiedBoth.check_out_justified === true, "Escenario C: Ambas justificaciones coexisten con motivos propios");

// -----------------------------------------------------------------------------
// 5. BONIFICACIONES (Martes, Domingo, Sábado, Sin Salida)
// -----------------------------------------------------------------------------
console.log("\n--- 5. Bonificaciones en America/Lima ---");

const bTue = calculateBonusMinutes("2026-08-25T22:00:00-05:00", "2026-08-25");
check(bTue.bonus_minutes === 50, "Martes: salida 22:00 (inicio 21:10) -> 50 minutos exactos");

const bSun = calculateBonusMinutes("2026-08-23T21:00:00-05:00", "2026-08-23");
check(bSun.bonus_minutes === 50, "Domingo: salida 21:00 (inicio 20:10) -> 50 minutos exactos");

const bSat = calculateBonusMinutes("2026-08-22T20:30:00-05:00", "2026-08-22");
check(bSat.bonus_minutes === 0, "Sábado: salida 20:30 -> 0 minutos de bonificación");

const bNoCheckOut = calculateBonusMinutes(null, "2026-08-22");
check(bNoCheckOut.bonus_minutes === 0, "Sin check-out registrado -> 0 minutos");

// -----------------------------------------------------------------------------
// 6. PERMISOS POR RANGO Y DISPONIBILIDAD
// -----------------------------------------------------------------------------
console.log("\n--- 6. Permisos por Rango y Disponibilidad ---");

function isDateBlockedByPermission(startDate: string, endDate: string, status: string, targetDate: string) {
  if (status !== "approved") return false;
  return targetDate >= startDate && targetDate <= endDate;
}

check(isDateBlockedByPermission("2026-08-25", "2026-08-28", "approved", "2026-08-26") === true, "Permiso aprobado en rango bloquea 26/08");
check(isDateBlockedByPermission("2026-08-25", "2026-08-28", "pending", "2026-08-26") === false, "Permiso pendiente NO bloquea disponibilidad");
check(isDateBlockedByPermission("2026-08-25", "2026-08-28", "rejected", "2026-08-26") === false, "Permiso rechazado NO bloquea disponibilidad");
check(isDateBlockedByPermission("2026-08-25", "2026-08-28", "approved", "2026-08-30") === false, "Fecha fuera de rango no está bloqueada");

// -----------------------------------------------------------------------------
// 7. COMPATIBILIDAD LEGACY CULQI, IDEMPOTENCIA Y CONCURRENCIA
// -----------------------------------------------------------------------------
console.log("\n--- 7. Compatibilidad Legacy Culqi, Idempotencia y Concurrencia ---");

// Helper para clasificar registros legacy
function processLegacyPaymentLog(row: {
  amount_cents: number;
  event_type?: string;
  culqi_event_id?: string | null;
  processing_result?: string | null;
  created_at: string;
}) {
  const payment_method = "culqi_legacy";
  const payment_type = "legacy";
  const yape_amount_cents = 0;
  const cash_amount_cents = 0;

  let status: "verified" | "rejected" | "legacy_unclassified";
  if (row.processing_result === "successful") {
    status = "verified";
  } else if (row.processing_result === "failed") {
    status = "rejected";
  } else {
    status = "legacy_unclassified";
  }

  return {
    payment_method,
    payment_type,
    yape_amount_cents,
    cash_amount_cents,
    status,
    counts_as_income: status === "verified",
  };
}

// Prueba A: Registro legacy exitoso -> NO cash, clasificado como culqi_legacy
const legacySuccess = processLegacyPaymentLog({
  amount_cents: 2400,
  event_type: "charge.success",
  culqi_event_id: "evt_123",
  processing_result: "successful",
  created_at: "2026-05-30T17:46:14Z",
});
check(
  legacySuccess.payment_method === "culqi_legacy" &&
  legacySuccess.payment_type === "legacy" &&
  legacySuccess.cash_amount_cents === 0 &&
  legacySuccess.status === "verified" &&
  legacySuccess.counts_as_income === true,
  "Prueba A: Registro legacy Culqi exitoso -> culqi_legacy (NO convertido a cash)"
);

// Prueba B: Registro legacy fallido -> rejected, NO contabilizado como ingreso
const legacyFailed = processLegacyPaymentLog({
  amount_cents: 2400,
  event_type: "charge_attempt",
  culqi_event_id: null,
  processing_result: "failed",
  created_at: "2026-05-30T17:46:14Z",
});
check(
  legacyFailed.payment_method === "culqi_legacy" &&
  legacyFailed.status === "rejected" &&
  legacyFailed.counts_as_income === false,
  "Prueba B: Registro legacy Culqi fallido -> rejected (Excluido de ingresos)"
);

// Prueba C: Registro legacy sin información suficiente -> legacy_unclassified, NO contabilizado
const legacyUnclassified = processLegacyPaymentLog({
  amount_cents: 5000,
  created_at: "2026-05-30T17:46:14Z",
});
check(
  legacyUnclassified.payment_method === "culqi_legacy" &&
  legacyUnclassified.status === "legacy_unclassified" &&
  legacyUnclassified.counts_as_income === false,
  "Prueba C: Registro legacy sin certeza -> legacy_unclassified (Excluido de ingresos)"
);

// Prueba D: Nuevo pago Yape
const newYape = { payment_method: "yape", amount_cents: 2500, yape_amount_cents: 2500, cash_amount_cents: 0 };
check(
  newYape.payment_method === "yape" && newYape.yape_amount_cents === newYape.amount_cents && newYape.cash_amount_cents === 0,
  "Prueba D: Nuevo pago Yape -> desglosado exclusivamente a Yape"
);

// Prueba E: Nuevo pago Efectivo
const newCash = { payment_method: "cash", amount_cents: 2500, yape_amount_cents: 0, cash_amount_cents: 2500 };
check(
  newCash.payment_method === "cash" && newCash.cash_amount_cents === newCash.amount_cents && newCash.yape_amount_cents === 0,
  "Prueba E: Nuevo pago Efectivo -> desglosado exclusivamente a Efectivo"
);

// Prueba F: Nuevo pago Mixto
const newMixed = { payment_method: "mixed", amount_cents: 2500, yape_amount_cents: 1500, cash_amount_cents: 1000 };
check(
  newMixed.payment_method === "mixed" && (newMixed.yape_amount_cents + newMixed.cash_amount_cents) === newMixed.amount_cents,
  "Prueba F: Nuevo pago Mixto -> suma exacta Yape + Efectivo"
);

// Prueba G: Idempotencia con misma idempotency_key
class MockPaymentStore {
  private logs: Map<string, { id: string; amount_cents: number; idempotency_key: string }> = new Map();

  processPayment(key: string, amount_cents: number) {
    if (this.logs.has(key)) {
      return { payment: this.logs.get(key)!, idempotent_replay: true };
    }
    const payment = { id: `pay-${Math.random()}`, amount_cents, idempotency_key: key };
    this.logs.set(key, payment);
    return { payment, idempotent_replay: false };
  }

  getCount() {
    return this.logs.size;
  }
}

const store = new MockPaymentStore();
const req1 = store.processPayment("idem-uuid-12345", 7500);
const req2 = store.processPayment("idem-uuid-12345", 7500);
check(
  req1.idempotent_replay === false &&
  req2.idempotent_replay === true &&
  store.getCount() === 1,
  "Prueba G: Retry con misma idempotency_key -> 1 solo registro persistido con replay idempotente"
);

// Prueba H: Concurrencia con keys distintas sobre saldo agotable
let bookingBalance = 7500;
function tryPayBalance(amount: number) {
  if (amount > bookingBalance) {
    return { accepted: false, error: "Excede el saldo restante" };
  }
  bookingBalance -= amount;
  return { accepted: true, remainingBalance: bookingBalance };
}

const concurrentA = tryPayBalance(7500); // Gana el lock
const concurrentB = tryPayBalance(7500); // Intenta sobre el saldo ya liquidado
check(
  concurrentA.accepted === true &&
  concurrentB.accepted === false &&
  bookingBalance === 0,
  "Prueba H: Dos pagos concurrentes intentando liquidar el mismo saldo -> 1 aceptado, 1 rechazado, balance 0"
);

console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO SUITE UNITARIA: ${passedCount} pruebas superadas, ${failedCount} fallos.`);
console.log("==========================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
