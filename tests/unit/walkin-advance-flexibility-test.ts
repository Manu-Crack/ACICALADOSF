/**
 * Test unitario para verificar la flexibilización total del monto de adelanto en Reservas Presenciales (Walk-in).
 * 
 * Reglas auditadas:
 * 1. Aceptación libre de valores enteros directos (ej. 5, 6, 10, 20) sin restricciones de step o redondeos forzados.
 * 2. Aceptación de importes decimales (ej. 6.50, 12.80).
 * 3. Cálculo en tiempo real del saldo pendiente exacto:
 *    - Total S/ 20.00, Adelanto S/ 6.00 -> Saldo Pendiente S/ 14.00
 *    - Total S/ 20.00, Adelanto S/ 6.50 -> Saldo Pendiente S/ 13.50
 * 4. Validación estricta:
 *    - Adelanto <= 0 o vacío -> Rechazado
 *    - Adelanto > Total -> Rechazado
 * 5. Generación correcta de payload contable (advance_amount_cents, balance_cents).
 */

function calculateWalkInPaymentState(totalPriceCents: number, advanceInputStr: string) {
  const num = parseFloat(advanceInputStr);
  const parsedAdvanceSoles = isNaN(num) || num < 0 ? 0 : num;
  const advanceAmountCents = Math.round(parsedAdvanceSoles * 100);
  const pendingBalanceCents = Math.max(0, totalPriceCents - advanceAmountCents);

  // Validación de formulario
  let error: string | null = null;
  if (!advanceInputStr.trim() || parsedAdvanceSoles <= 0) {
    error = "Por favor, ingresa un monto de adelanto válido mayor a S/ 0.00.";
  } else if (advanceAmountCents > totalPriceCents) {
    error = `El monto del adelanto (S/ ${parsedAdvanceSoles.toFixed(2)}) no puede exceder el total a cobrar (S/ ${(totalPriceCents / 100).toFixed(2)}).`;
  }

  return {
    parsedAdvanceSoles: parsedAdvanceSoles.toFixed(2),
    advanceAmountCents,
    pendingBalanceSoles: (pendingBalanceCents / 100).toFixed(2),
    pendingBalanceCents,
    isValid: error === null,
    error,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log("\n==========================================================================");
console.log(" 🧪 AUDITORÍA DE FLEXIBILIZACIÓN DE ADELANTO EN RESERVAS PRESENCIALES");
console.log("==========================================================================");

// Caso 1: Entero directo 6 sobre total 20 soles (Caso exacto reportado por usuario)
console.log("\n--- 1. Caso Base Reportado: Entero directo S/ 6 sobre cita de S/ 20 ---");
const case1 = calculateWalkInPaymentState(2000, "6");
assert(case1.isValid, "Monto entero 6 es válido y no produce error de validación");
assert(case1.parsedAdvanceSoles === "6.00", "Adelanto renderizado es exactamente S/ 6.00");
assert(case1.advanceAmountCents === 600, "Adelanto computado en centavos es 600 cents");
assert(case1.pendingBalanceSoles === "14.00", "Saldo pendiente renderizado es exactamente S/ 14.00");
assert(case1.pendingBalanceCents === 1400, "Saldo pendiente computado en centavos es 1400 cents");

// Caso 2: Otros enteros directos (5, 10, 20)
console.log("\n--- 2. Aceptación de Otros Enteros Directos (5, 10, 20) ---");
const case5 = calculateWalkInPaymentState(2000, "5");
assert(case5.isValid && case5.pendingBalanceSoles === "15.00", "Entero 5 -> Saldo pendiente S/ 15.00");

const case10 = calculateWalkInPaymentState(2000, "10");
assert(case10.isValid && case10.pendingBalanceSoles === "10.00", "Entero 10 -> Saldo pendiente S/ 10.00");

const case20 = calculateWalkInPaymentState(2000, "20");
assert(case20.isValid && case20.pendingBalanceSoles === "0.00", "Entero 20 (pago total via adelanto) -> Saldo S/ 0.00");

// Caso 3: Decimales libres (6.50, 12.80)
console.log("\n--- 3. Aceptación de Decimales Libres (6.50, 12.80) ---");
const caseDec1 = calculateWalkInPaymentState(2000, "6.50");
assert(caseDec1.isValid, "Decimal 6.50 es válido");
assert(caseDec1.parsedAdvanceSoles === "6.50", "Adelanto renderizado es S/ 6.50");
assert(caseDec1.pendingBalanceSoles === "13.50", "Saldo pendiente renderizado es S/ 13.50 (20.00 - 6.50)");

const caseDec2 = calculateWalkInPaymentState(2000, "12.80");
assert(caseDec2.isValid, "Decimal 12.80 es válido");
assert(caseDec2.parsedAdvanceSoles === "12.80", "Adelanto renderizado es S/ 12.80");
assert(caseDec2.pendingBalanceSoles === "7.20", "Saldo pendiente renderizado es S/ 7.20 (20.00 - 12.80)");

// Caso 4: Validaciones de frontera (> 0 y <= total)
console.log("\n--- 4. Validaciones de Frontera ---");
const caseZero = calculateWalkInPaymentState(2000, "0");
assert(!caseZero.isValid, "Adelanto 0 es inválido");

const caseNegative = calculateWalkInPaymentState(2000, "-5");
assert(!caseNegative.isValid, "Adelanto negativo es inválido");

const caseEmpty = calculateWalkInPaymentState(2000, "");
assert(!caseEmpty.isValid, "Adelanto vacío es inválido");

const caseExceed = calculateWalkInPaymentState(2000, "25");
assert(!caseExceed.isValid, "Adelanto mayor al total (S/ 25 > S/ 20) es rechazado");

console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO: ${passed} pruebas superadas, ${failed} fallos.`);
console.log("==========================================================================\n");

if (failed > 0) {
  process.exit(1);
}
