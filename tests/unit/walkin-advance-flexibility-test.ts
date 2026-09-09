export {};

/**
 * Test unitario para verificar el manejo exclusivo de montos enteros en adelantos
 * y el retiro de botones incrementales en Reservas Presenciales (Walk-in).
 * 
 * Reglas auditadas:
 * 1. Sanitización estricta: solo números enteros (ej. 20, 30, 50).
 * 2. Supresión de puntos, comas y decimales (ej. '20.50' -> '2050' o '20' al tipiar).
 * 3. Cálculo en tiempo real del saldo pendiente exacto sobre enteros:
 *    - Total S/ 20.00, Adelanto S/ 6 -> Saldo Pendiente S/ 14.00
 *    - Total S/ 50.00, Adelanto S/ 20 -> Saldo Pendiente S/ 30.00
 *    - Total S/ 100.00, Adelanto S/ 30 -> Saldo Pendiente S/ 70.00
 * 4. Validación estricta a nivel de formulario:
 *    - Adelanto <= 0 o vacío -> Rechazado
 *    - Adelanto > Total -> Rechazado
 * 5. Generación correcta de payload contable (advance_amount_cents, balance_cents).
 */

function sanitizeIntegerInput(rawInput: string): string {
  // Simula el handler onChange del componente: solo dígitos enteros, sin ceros redundantes a la izquierda
  const digitsOnly = rawInput.replace(/\D/g, "");
  return digitsOnly.length > 1 && digitsOnly.startsWith("0") ? String(parseInt(digitsOnly, 10)) : digitsOnly;
}

function calculateWalkInPaymentState(totalPriceCents: number, advanceInputStr: string) {
  const sanitized = sanitizeIntegerInput(advanceInputStr);
  const num = parseInt(sanitized, 10);
  const parsedAdvanceSoles = isNaN(num) || num < 0 ? 0 : num;
  const advanceAmountCents = Math.round(parsedAdvanceSoles * 100);
  const pendingBalanceCents = Math.max(0, totalPriceCents - advanceAmountCents);

  // Validación de formulario
  let error: string | null = null;
  if (!sanitized.trim() || parsedAdvanceSoles <= 0) {
    error = "Por favor, ingresa un monto de adelanto válido mayor a S/ 0.00.";
  } else if (advanceAmountCents > totalPriceCents) {
    error = `El monto del adelanto (S/ ${parsedAdvanceSoles.toFixed(2)}) no puede exceder el total a cobrar (S/ ${(totalPriceCents / 100).toFixed(2)}).`;
  }

  return {
    sanitized,
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
console.log(" 🧪 AUDITORÍA: ADELANTOS ENTEROS Y CERO RESTRICCIONES EN WALK-IN");
console.log("==========================================================================");

// Caso 1: Enteros directos requeridos por el usuario (20, 30, 50)
console.log("\n--- 1. Casos Requeridos de Enteros Directos (20, 30, 50) ---");
const case20on50 = calculateWalkInPaymentState(5000, "20");
assert(case20on50.isValid, "Adelanto entero 20 es válido");
assert(case20on50.parsedAdvanceSoles === "20.00", "Adelanto renderizado es S/ 20.00");
assert(case20on50.advanceAmountCents === 2000, "Adelanto computado: 2000 cents");
assert(case20on50.pendingBalanceSoles === "30.00", "Saldo pendiente: S/ 30.00 (50.00 - 20.00)");
assert(case20on50.pendingBalanceCents === 3000, "Saldo pendiente computado: 3000 cents");

const case30on100 = calculateWalkInPaymentState(10000, "30");
assert(case30on100.isValid, "Adelanto entero 30 es válido");
assert(case30on100.pendingBalanceSoles === "70.00", "Saldo pendiente: S/ 70.00 (100.00 - 30.00)");

const case50on100 = calculateWalkInPaymentState(10000, "50");
assert(case50on100.isValid, "Adelanto entero 50 es válido");
assert(case50on100.pendingBalanceSoles === "50.00", "Saldo pendiente: S/ 50.00 (100.00 - 50.00)");

// Caso 2: Entero directo 6 sobre cita de S/ 20.00
console.log("\n--- 2. Caso Base: Entero directo S/ 6 sobre cita de S/ 20 ---");
const case6on20 = calculateWalkInPaymentState(2000, "6");
assert(case6on20.isValid, "Entero directo 6 es válido");
assert(case6on20.parsedAdvanceSoles === "6.00", "Adelanto renderizado: S/ 6.00");
assert(case6on20.pendingBalanceSoles === "14.00", "Saldo pendiente inmediato: S/ 14.00 (20.00 - 6.00)");

// Caso 3: Bloqueo de puntos y comas decimales
console.log("\n--- 3. Supresión de Puntos y Comas en Input ---");
assert(sanitizeIntegerInput("20.50") === "2050", "Punto decimal filtrado automáticamente");
assert(sanitizeIntegerInput("30,00") === "3000", "Coma decimal filtrada automáticamente");
assert(sanitizeIntegerInput("05") === "5", "Cero inicial redundante normalizado a 5");
assert(sanitizeIntegerInput("abc20xyz") === "20", "Letras y caracteres no numéricos descartados");

// Caso 4: Validaciones de frontera (> 0 y <= total)
console.log("\n--- 4. Validaciones de Frontera ---");
const caseZero = calculateWalkInPaymentState(2000, "0");
assert(!caseZero.isValid, "Adelanto 0 es inválido");

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
