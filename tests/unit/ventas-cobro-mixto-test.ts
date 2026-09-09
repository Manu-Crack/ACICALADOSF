import {
  formatMixedPaymentMethod,
  parseVentaPaymentBreakdown,
  extractTicketMixedBreakdown,
  calculateRemainingAmount,
  validateMixedAmounts,
  MIXED_PAIR_CONFIGS,
} from "@/lib/utils/ventas-mixed";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
  }
}

console.log("==========================================================================");
console.log(" 🧪 AUDITORÍA: COBRO MIXTO DINÁMICO EN VENTAS RÁPIDAS / MOSTRADOR");
console.log("==========================================================================");

// --- 1. Autocálculo Reactivo Bidireccional ---
console.log("\n--- 1. Autocálculo Reactivo Bidireccional ---");
{
  const liveTotal = 60.0; // Ejemplo de captura: 3 × S/ 20.00 = S/ 60.00

  // Usuario escribe 20 en Efectivo -> Yape debe autocompletar 40.00
  const monto1 = 20.0;
  const monto2Calculado = calculateRemainingAmount(liveTotal, monto1);
  assert(
    monto2Calculado === 40.0,
    `Monto 2 = Total (${liveTotal}) - Monto 1 (${monto1}) -> Autocompleta S/ ${monto2Calculado.toFixed(2)}`
  );

  // Bidireccional: si se modifica la segunda casilla a 15, la primera debe ajustarse a 45
  const nuevoMonto2 = 15.0;
  const monto1Ajustado = calculateRemainingAmount(liveTotal, nuevoMonto2);
  assert(
    monto1Ajustado === 45.0,
    `Bidireccional: Monto 1 = Total (${liveTotal}) - Monto 2 (${nuevoMonto2}) -> Ajusta a S/ ${monto1Ajustado.toFixed(2)}`
  );

  // Si monto ingresado excede el total, el faltante queda en 0
  const montoExcesivo = 75.0;
  assert(
    calculateRemainingAmount(liveTotal, montoExcesivo) === 0,
    "Monto ingresado mayor al total no genera valores negativos (retorna 0)"
  );
}

// --- 2. Reajuste ante cambio de Cantidad o Precio Unitario ---
console.log("\n--- 2. Reajuste ante cambios en Cantidad o Precio Unitario ---");
{
  // Total inicial: 3 × 20 = 60. Monto 1 fijado en 20.
  const monto1 = 20.0;
  let cantidad = 3;
  let precioUnitario = 20.0;
  let totalCalculado = cantidad * precioUnitario; // 60.00

  let monto2 = calculateRemainingAmount(totalCalculado, monto1);
  assert(monto2 === 40.0, "Total inicial S/ 60.00 -> Monto 2 es S/ 40.00");

  // Usuario incrementa cantidad a 4 -> nuevo total = S/ 80.00
  cantidad = 4;
  totalCalculado = cantidad * precioUnitario; // 80.00
  monto2 = calculateRemainingAmount(totalCalculado, monto1);
  assert(
    monto2 === 60.0,
    `Nuevo total S/ ${totalCalculado.toFixed(2)} -> Monto 2 se reajusta automáticamente a S/ ${monto2.toFixed(2)} manteniendo Monto 1 = S/ ${monto1.toFixed(2)}`
  );

  // Usuario aplica descuento en precio unitario a S/ 15.00 -> nuevo total = 4 × 15 = S/ 60.00
  precioUnitario = 15.0;
  totalCalculado = cantidad * precioUnitario; // 60.00
  monto2 = calculateRemainingAmount(totalCalculado, monto1);
  assert(
    monto2 === 40.0,
    `Nuevo total con rebaja S/ ${totalCalculado.toFixed(2)} -> Monto 2 se reajusta de inmediato a S/ ${monto2.toFixed(2)}`
  );
}

// --- 3. Validación Matemática Estricta ---
console.log("\n--- 3. Validación Matemática Estricta de Cobertura 100% ---");
{
  const total = 60.0;

  // Caso exacto (20 + 40 = 60) -> Válido
  assert(
    validateMixedAmounts(total, 20.0, 40.0),
    "Suma exacta: S/ 20.00 + S/ 40.00 = S/ 60.00 es VÁLIDA"
  );

  // Caso decimal exacto (25.50 + 34.50 = 60) -> Válido
  assert(
    validateMixedAmounts(total, 25.5, 34.5),
    "Suma con decimales: S/ 25.50 + S/ 34.50 = S/ 60.00 es VÁLIDA"
  );

  // Caso incompleto (20 + 30 = 50 != 60) -> Inválido (bloquea botones)
  assert(
    !validateMixedAmounts(total, 20.0, 30.0),
    "Suma insuficiente (S/ 50.00 != S/ 60.00) es INVÁLIDA (bloquea registro)"
  );

  // Caso excedente (30 + 40 = 70 != 60) -> Inválido
  assert(
    !validateMixedAmounts(total, 30.0, 40.0),
    "Suma excedente (S/ 70.00 != S/ 60.00) es INVÁLIDA"
  );

  // Caso de una casilla en cero (0 + 60 = 60) -> Inválido (debe haber 2 vías reales)
  assert(
    !validateMixedAmounts(total, 0.0, 60.0),
    "Cobro con un monto en S/ 0.00 no califica como mixto (requiere 2 métodos)"
  );
}

// --- 4. Parejas de Métodos y Formato de Persistencia ---
console.log("\n--- 4. Parejas de Métodos y Formateo para Base de Datos e Historial ---");
{
  // 1. Efectivo + Yape
  const str1 = formatMixedPaymentMethod(
    MIXED_PAIR_CONFIGS.efectivo_yape.method1,
    20,
    MIXED_PAIR_CONFIGS.efectivo_yape.method2,
    40
  );
  assert(
    str1 === "Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)",
    `Formato Efectivo + Yape: "${str1}"`
  );

  // 2. Efectivo + Transferencia
  const str2 = formatMixedPaymentMethod(
    MIXED_PAIR_CONFIGS.efectivo_transferencia.method1,
    25,
    MIXED_PAIR_CONFIGS.efectivo_transferencia.method2,
    35
  );
  assert(
    str2 === "Mixto (Efectivo: S/ 25.00 | Transferencia: S/ 35.00)",
    `Formato Efectivo + Transferencia: "${str2}"`
  );

  // 3. Yape + Transferencia
  const str3 = formatMixedPaymentMethod(
    MIXED_PAIR_CONFIGS.yape_transferencia.method1,
    30,
    MIXED_PAIR_CONFIGS.yape_transferencia.method2,
    30
  );
  assert(
    str3 === "Mixto (Yape: S/ 30.00 | Transferencia: S/ 30.00)",
    `Formato Yape + Transferencia: "${str3}"`
  );
}

// --- 5. Desglose Estructurado para Impresión de Ticket Térmico ---
console.log("\n--- 5. Desglose para Impresión de Ticket Térmico (80mm) ---");
{
  const metodoPago = "Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)";
  const ticketItems = extractTicketMixedBreakdown(metodoPago);

  assert(ticketItems !== null, "Detecta método de pago mixto para ticket térmico");
  assert(ticketItems?.length === 2, "Extrae exactamente 2 métodos del desglose");
  assert(
    ticketItems?.[0].method === "Efectivo" && ticketItems?.[0].amount === 20.0,
    `Línea 1 del Ticket: - ${ticketItems?.[0].method?.toUpperCase()}: S/ ${ticketItems?.[0].amount?.toFixed(2)}`
  );
  assert(
    ticketItems?.[1].method === "Yape" && ticketItems?.[1].amount === 40.0,
    `Línea 2 del Ticket: - ${ticketItems?.[1].method?.toUpperCase()}: S/ ${ticketItems?.[1].amount?.toFixed(2)}`
  );
}

// --- 6. Imputación Contable Exacta en Canales Financieros (Reportes e Inicio) ---
console.log("\n--- 6. Imputación Contable Exacta en Canales Financieros ---");
{
  // Venta de S/ 60.00 -> Efectivo 20.00, Yape 40.00
  const b1 = parseVentaPaymentBreakdown("Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)", 6000);
  assert(b1.isMixed === true, "Identifica venta como mixta");
  assert(b1.efectivoCents === 2000, "Caja física (Efectivo) recibe exactamente S/ 20.00 (2000 cents)");
  assert(b1.yapeCents === 4000, "Cuentas digitales (Yape) recibe exactamente S/ 40.00 (4000 cents)");
  assert(b1.transferenciaCents === 0, "Transferencia recibe S/ 0.00");

  // Venta Efectivo + Transferencia: S/ 70.00 -> Efectivo 25.00, Transferencia 45.00
  const b2 = parseVentaPaymentBreakdown("Mixto (Efectivo: S/ 25.00 | Transferencia: S/ 45.00)", 7000);
  assert(b2.efectivoCents === 2500, "Caja física (Efectivo) recibe S/ 25.00");
  assert(b2.transferenciaCents === 4500, "Transferencia recibe S/ 45.00");
  assert(b2.yapeCents === 0, "Yape recibe S/ 0.00");

  // Venta Yape + Transferencia: S/ 50.00 -> Yape 20.00, Transferencia 30.00
  const b3 = parseVentaPaymentBreakdown("Mixto (Yape: S/ 20.00 | Transferencia: S/ 30.00)", 5000);
  assert(b3.efectivoCents === 0, "Caja física recibe S/ 0.00");
  assert(b3.yapeCents === 2000, "Yape recibe S/ 20.00");
  assert(b3.transferenciaCents === 3000, "Transferencia recibe S/ 30.00");
}

// --- 7. No Regresión en Métodos de Pago Único ---
console.log("\n--- 7. No Regresión en Métodos de Pago Único ---");
{
  const pCash = parseVentaPaymentBreakdown("Efectivo", 5000);
  assert(pCash.isMixed === false && pCash.efectivoCents === 5000 && pCash.yapeCents === 0, "Pago único en Efectivo intacto");

  const pYape = parseVentaPaymentBreakdown("Yape", 5000);
  assert(pYape.isMixed === false && pYape.yapeCents === 5000 && pYape.efectivoCents === 0, "Pago único en Yape intacto");

  const pTrans = parseVentaPaymentBreakdown("Transferencia", 5000);
  assert(pTrans.isMixed === false && pTrans.transferenciaCents === 5000 && pTrans.efectivoCents === 0, "Pago único en Transferencia intacto");
}

console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO: ${passed} pasadas, ${failed} falladas.`);
console.log("==========================================================================");

if (failed > 0) {
  process.exit(1);
}
