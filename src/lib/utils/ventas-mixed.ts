/**
 * Utilidades para Cobro Mixto Dinámico en Ventas de Mostrador
 * Maneja combinaciones de métodos, autocálculo reactivo, formateo para base de datos
 * y tickets térmicos, así como la imputación a canales financieros.
 */

export type MixedPairOption = "efectivo_yape" | "efectivo_transferencia" | "yape_transferencia";

export interface MixedPairConfig {
  id: MixedPairOption;
  label: string;
  method1: "Efectivo" | "Yape";
  method2: "Yape" | "Transferencia";
  icon1: string;
  icon2: string;
}

export const MIXED_PAIR_CONFIGS: Record<MixedPairOption, MixedPairConfig> = {
  efectivo_yape: {
    id: "efectivo_yape",
    label: "Efectivo + Yape",
    method1: "Efectivo",
    method2: "Yape",
    icon1: "💵",
    icon2: "📱",
  },
  efectivo_transferencia: {
    id: "efectivo_transferencia",
    label: "Efectivo + Transferencia",
    method1: "Efectivo",
    method2: "Transferencia",
    icon1: "💵",
    icon2: "🏦",
  },
  yape_transferencia: {
    id: "yape_transferencia",
    label: "Yape + Transferencia",
    method1: "Yape",
    method2: "Transferencia",
    icon1: "📱",
    icon2: "🏦",
  },
};

export interface MixedBreakdownItem {
  method: string;
  amount: number;
}

export interface VentaPaymentBreakdown {
  efectivoCents: number;
  yapeCents: number;
  transferenciaCents: number;
  isMixed: boolean;
  items: MixedBreakdownItem[];
}

/**
 * Genera la cadena representativa del pago compuesto para la base de datos e historial
 * Ejemplo: "Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)"
 */
export function formatMixedPaymentMethod(
  method1: string,
  amount1: number,
  method2: string,
  amount2: number
): string {
  const a1 = Math.max(0, amount1).toFixed(2);
  const a2 = Math.max(0, amount2).toFixed(2);
  return `Mixto (${method1}: S/ ${a1} | ${method2}: S/ ${a2})`;
}

/**
 * Extrae los componentes de un método de pago mixto para la impresión de tickets térmicos.
 * Si es compuesto, retorna la lista de métodos y montos individuales.
 */
export function extractTicketMixedBreakdown(
  metodoPago: string | null | undefined
): MixedBreakdownItem[] | null {
  if (!metodoPago || !metodoPago.startsWith("Mixto")) {
    return null;
  }

  // Regex para capturar pares "Método: S/ 00.00"
  // Ejemplos: "Mixto (Efectivo: S/ 20.00 | Yape: S/ 40.00)"
  const regex = /([A-Za-zÁÉÍÓÚáéíóú]+):\s*S\/\s*([\d.]+)/gi;
  const items: MixedBreakdownItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(metodoPago)) !== null) {
    const method = match[1].trim();
    const amount = parseFloat(match[2]);
    if (!isNaN(amount)) {
      items.push({
        method: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
        amount,
      });
    }
  }

  if (items.length >= 2) {
    return items;
  }

  return null;
}

/**
 * Desglosa los importes en centavos hacia los canales contables individuales
 * (Caja Física / Efectivo, Yape, Transferencia).
 */
export function parseVentaPaymentBreakdown(
  metodoPago: string | null | undefined,
  totalCents: number
): VentaPaymentBreakdown {
  const norm = (metodoPago || "Efectivo").trim();

  let efectivoCents = 0;
  let yapeCents = 0;
  let transferenciaCents = 0;

  if (norm.startsWith("Mixto")) {
    const items = extractTicketMixedBreakdown(norm);
    if (items && items.length >= 2) {
      items.forEach((item) => {
        const itemCents = Math.round(item.amount * 100);
        const m = item.method.toLowerCase();
        if (m === "efectivo") {
          efectivoCents += itemCents;
        } else if (m === "yape") {
          yapeCents += itemCents;
        } else if (m === "transferencia") {
          transferenciaCents += itemCents;
        }
      });

      return {
        efectivoCents,
        yapeCents,
        transferenciaCents,
        isMixed: true,
        items,
      };
    }

    // Si es "Mixto" genérico sin desglose textual (compatibilidad previa): split 50/50
    const half = Math.floor(totalCents / 2);
    return {
      efectivoCents: totalCents - half,
      yapeCents: half,
      transferenciaCents: 0,
      isMixed: true,
      items: [
        { method: "Efectivo", amount: (totalCents - half) / 100 },
        { method: "Yape", amount: half / 100 },
      ],
    };
  }

  const lower = norm.toLowerCase();
  if (lower === "yape") {
    yapeCents = totalCents;
  } else if (lower === "transferencia") {
    transferenciaCents = totalCents;
  } else {
    efectivoCents = totalCents;
  }

  return {
    efectivoCents,
    yapeCents,
    transferenciaCents,
    isMixed: false,
    items: [],
  };
}

/**
 * Autocalcula el segundo monto en base al total y al primer monto ingresado:
 * Monto 2 = TOTAL - Monto 1
 */
export function calculateRemainingAmount(total: number, amount1: number): number {
  const diff = Math.round((total - amount1) * 100) / 100;
  return Math.max(0, diff);
}

/**
 * Valida si la suma de ambos montos iguala exactamente al total calculado (tolerancia de 0.01)
 */
export function validateMixedAmounts(
  total: number,
  amount1: number,
  amount2: number
): boolean {
  if (amount1 <= 0 || amount2 <= 0) return false;
  const sum = Math.round((amount1 + amount2) * 100) / 100;
  return Math.abs(sum - total) < 0.005;
}
