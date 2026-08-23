/**
 * Tipos TypeScript para el sistema de pagos de Acicalados.
 * Coinciden exactamente con los CHECK constraints de la tabla payment_logs.
 */

// ---------------------------------------------------------------------------
// Enumeraciones de dominio
// ---------------------------------------------------------------------------

export type PaymentMethod =
  | "yape"
  | "efectivo"
  | "cash"
  | "transferencia"
  | "mixto"
  | "mixed"
  | "culqi_legacy";

export type PaymentType =
  | "advance"   // Adelanto (mínimo 25%)
  | "partial"   // Pago parcial sin llegar al total
  | "balance"   // Pago del saldo restante
  | "full"      // Pago completo en un solo movimiento
  | "total"     // Pago total (alias)
  | "refund"    // Devolución / reversión
  | "legacy";   // Registro histórico previo a la migración

export type PaymentStatus =
  | "pending"              // Registrado, pendiente de verificación
  | "verified"             // Verificado — cuenta como ingreso
  | "rejected"             // Rechazado — no cuenta
  | "voided"               // Anulado — no cuenta, registro conservado
  | "legacy_unclassified"; // Registro histórico no confirmado

// ---------------------------------------------------------------------------
// Interfaz del registro de pago (payment_logs)
// ---------------------------------------------------------------------------

export interface PaymentLog {
  id: string;
  idempotency_key?: string | null;
  booking_id: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  payment_type: PaymentType;
  yape_amount_cents: number;
  cash_amount_cents: number;
  status: PaymentStatus;
  proof_url: string | null;
  notes: string | null;
  paid_at: string;
  verified_at: string | null;
  verified_by: string | null;
  registered_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Versión con datos del registrador (para mostrar en historial)
export interface PaymentLogWithUser extends PaymentLog {
  registered_by_name?: string;
  voided_by_name?: string;
}

// ---------------------------------------------------------------------------
// Payload para crear un nuevo pago
// ---------------------------------------------------------------------------

export interface CreatePaymentPayload {
  idempotency_key?: string;
  booking_id: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  payment_type: PaymentType;
  yape_amount_cents: number;
  cash_amount_cents: number;
  notes?: string;
  proof_url?: string;
}

// ---------------------------------------------------------------------------
// Payload para anular un pago (solo admin)
// ---------------------------------------------------------------------------

export interface VoidPaymentPayload {
  void_reason: string;
}

// ---------------------------------------------------------------------------
// Resumen financiero de una reserva
// ---------------------------------------------------------------------------

export interface BookingFinancialSummary {
  booking_id: string;
  booking_code: string;
  total_price_cents: number;
  advance_percentage: number;
  advance_required_cents: number;  // ceil(total * advance_pct / 100)
  amount_paid_cents: number;        // suma de pagos verified
  balance_cents: number;            // total - amount_paid (mínimo 0)
  payment_status: string;           // sin_pago | parcial | total
  booking_status: string;           // pendiente | confirmada | completada | cancelada
  can_confirm: boolean;             // amount_paid >= advance_required
}

// ---------------------------------------------------------------------------
// Labels y colores para la UI (consistente con el design system)
// ---------------------------------------------------------------------------

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  yape:          "Yape",
  efectivo:      "Efectivo",
  cash:          "Efectivo",
  transferencia: "Transferencia",
  mixto:         "Mixto (Yape + Efectivo)",
  mixed:         "Mixto (Yape + Efectivo)",
  culqi_legacy:  "Culqi Histórico",
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  yape:          "💜",
  efectivo:      "💵",
  cash:          "💵",
  transferencia: "🏦",
  mixto:         "🔄",
  mixed:         "🔄",
  culqi_legacy:  "💳",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  advance: "Adelanto",
  partial: "Pago parcial",
  balance: "Saldo",
  full:    "Pago completo",
  total:   "Pago total",
  refund:  "Devolución",
  legacy:  "Histórico Culqi",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:              "Pendiente",
  verified:             "Verificado",
  rejected:             "Rechazado",
  voided:               "Anulado",
  legacy_unclassified:  "Histórico sin clasificar",
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  pending:              "badge-warning",
  verified:             "badge-success",
  rejected:             "badge-error",
  voided:               "badge-neutral",
  legacy_unclassified:  "badge-neutral",
};

// ---------------------------------------------------------------------------
// Constante de porcentaje de adelanto (configurable a futuro desde BD)
// ---------------------------------------------------------------------------

export const DEFAULT_ADVANCE_PERCENTAGE = 25;
