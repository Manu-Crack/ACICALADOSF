"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaymentLogWithUser, PaymentStatus } from "@/lib/types/payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_BADGE,
} from "@/lib/types/payments";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface BookingFinancial {
  id: string;
  booking_code: string;
  client_first_name?: string;
  client_last_name?: string;
  total_price_cents: number;
  advance_percentage: number;
  advance_required_cents: number;
  amount_paid_cents: number;
  balance_cents: number;
  payment_status: string;
  booking_status: string;
}

interface PaymentHistoryModalProps {
  bookingId: string;
  bookingCode: string;
  clientName: string;
  userRole: string;
  onClose: () => void;
  onPaymentVoided?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PaymentHistoryModal({
  bookingId,
  bookingCode,
  clientName,
  userRole,
  onClose,
  onPaymentVoided,
}: PaymentHistoryModalProps) {
  const isAdmin = userRole === "admin";

  const [booking, setBooking] = useState<BookingFinancial | null>(null);
  const [payments, setPayments] = useState<PaymentLogWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Anulación
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState<string>("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Carga de datos
  // ---------------------------------------------------------------------------

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments?booking_id=${bookingId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "No se pudieron cargar los pagos.");
        return;
      }
      const data = await res.json();
      setBooking(data.booking || null);
      setPayments(data.payments || []);
    } catch {
      setError("Error de conexión al cargar el historial de pagos.");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ---------------------------------------------------------------------------
  // Anulación de pago
  // ---------------------------------------------------------------------------

  const handleVoidPayment = useCallback(async (paymentId: string) => {
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setVoidError("Ingresa un motivo de anulación de al menos 5 caracteres.");
      return;
    }

    setVoidLoading(true);
    setVoidError(null);

    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", void_reason: voidReason.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setVoidError(data.error || "No se pudo anular el pago.");
        return;
      }

      setVoidingId(null);
      setVoidReason("");
      await loadPayments();
      onPaymentVoided?.();
    } catch {
      setVoidError("Error de conexión al intentar anular el pago.");
    } finally {
      setVoidLoading(false);
    }
  }, [voidReason, loadPayments, onPaymentVoided]);

  // ---------------------------------------------------------------------------
  // Helpers de formato
  // ---------------------------------------------------------------------------

  function formatDate(isoStr: string | null): string {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPaymentMethodDisplay(payment: PaymentLogWithUser): string {
    const icon = PAYMENT_METHOD_ICONS[payment.payment_method] ?? "💳";
    const label = PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method;
    if (payment.payment_method === "mixed") {
      return `${icon} ${label} (Yape S/ ${(payment.yape_amount_cents / 100).toFixed(2)} + Efect. S/ ${(payment.cash_amount_cents / 100).toFixed(2)})`;
    }
    return `${icon} ${label}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 700,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Historial de pagos de reserva ${bookingCode}`}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
              🧾 Historial de Pagos
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              {bookingCode} · {clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px", fontSize: "1rem", lineHeight: 1 }}
            aria-label="Cerrar historial de pagos"
          >
            ✕
          </button>
        </div>

        {/* Resumen financiero */}
        {booking && (
          <div
            style={{
              background: "rgba(200,164,92,0.06)",
              border: "1px solid rgba(200,164,92,0.2)",
              borderRadius: "var(--radius-md)",
              padding: "14px 16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "10px 16px",
            }}
          >
            {[
              { label: "Total servicio",           value: `S/ ${(booking.total_price_cents / 100).toFixed(2)}`,      color: "var(--color-text)" },
              { label: `Adelanto req. (${booking.advance_percentage}%)`, value: `S/ ${(booking.advance_required_cents / 100).toFixed(2)}`, color: "#f59e0b" },
              { label: "Total pagado",             value: `S/ ${(booking.amount_paid_cents / 100).toFixed(2)}`,      color: booking.amount_paid_cents > 0 ? "var(--color-success)" : "var(--color-text-muted)" },
              { label: "Saldo pendiente",          value: `S/ ${(booking.balance_cents / 100).toFixed(2)}`,          color: booking.balance_cents > 0 ? "#ef4444" : "var(--color-success)" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lista de pagos */}
        {loading ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p className="text-muted">Cargando historial...</p>
          </div>
        ) : error ? (
          <div style={{ padding: "16px", borderRadius: "var(--radius-md)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "0.85rem" }}>
            ❌ {error}
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>💳</div>
            <p className="text-muted" style={{ fontSize: "0.85rem" }}>No hay movimientos registrados para esta reserva.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {payments.map((payment) => {
              const status = payment.status as PaymentStatus;
              const isVoided = status === "voided";
              const isVoiding = voidingId === payment.id;
              const canVoid = isAdmin && status === "verified";

              return (
                <div
                  key={payment.id}
                  style={{
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${isVoided ? "rgba(107,114,128,0.25)" : "var(--color-border)"}`,
                    padding: "14px 16px",
                    background: isVoided ? "rgba(107,114,128,0.04)" : "var(--color-bg-input)",
                    opacity: isVoided ? 0.65 : 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {/* Fila principal del pago */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: "1rem", color: isVoided ? "var(--color-text-muted)" : "var(--color-text)" }}>
                          S/ {(payment.amount_cents / 100).toFixed(2)}
                        </span>
                        <span className={`badge ${PAYMENT_STATUS_BADGE[status] || "badge-neutral"}`} style={{ fontSize: "0.68rem" }}>
                          {PAYMENT_STATUS_LABELS[status] || status}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", padding: "2px 6px", background: "var(--color-bg-card)", borderRadius: 4, border: "1px solid var(--color-border)" }}>
                          {PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                        {getPaymentMethodDisplay(payment)}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      <p>{formatDate(payment.paid_at)}</p>
                      {payment.registered_by_name && (
                        <p>Por: {payment.registered_by_name}</p>
                      )}
                    </div>
                  </div>

                  {/* Notas del pago */}
                  {payment.notes && (
                    <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: 0, fontStyle: "italic" }}>
                      📝 {payment.notes}
                    </p>
                  )}

                  {/* Comprobante adjunto */}
                  {payment.proof_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem" }}>
                      <span>📎 Comprobante:</span>
                      <a
                        href={payment.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "2px 8px", fontSize: "0.72rem", color: "var(--color-primary)" }}
                      >
                        🔍 Ver comprobante
                      </a>
                    </div>
                  )}

                  {/* Información de anulación */}
                  {isVoided && payment.void_reason && (
                    <div style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.76rem", color: "#ef4444" }}>
                      🚫 Anulado {payment.voided_at ? `el ${formatDate(payment.voided_at)}` : ""}{payment.voided_by_name ? ` por ${payment.voided_by_name}` : ""}: {payment.void_reason}
                    </div>
                  )}

                  {/* Formulario de anulación (expandible, solo admin) */}
                  {canVoid && !isVoiding && (
                    <button
                      type="button"
                      onClick={() => { setVoidingId(payment.id); setVoidError(null); setVoidReason(""); }}
                      className="btn btn-ghost btn-sm"
                      style={{ alignSelf: "flex-start", fontSize: "0.75rem", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                    >
                      🚫 Anular movimiento
                    </button>
                  )}

                  {isVoiding && (
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <label className="label" style={{ color: "#ef4444", fontSize: "0.78rem" }} htmlFor={`void-reason-${payment.id}`}>
                        Motivo de anulación (mínimo 5 caracteres)
                      </label>
                      <input
                        id={`void-reason-${payment.id}`}
                        className="input"
                        placeholder="Ej: Pago duplicado, error en el monto..."
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        style={{ fontSize: "0.83rem" }}
                      />
                      {voidError && (
                        <p style={{ fontSize: "0.76rem", color: "#ef4444", margin: 0 }}>{voidError}</p>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => { setVoidingId(null); setVoidReason(""); setVoidError(null); }}
                          className="btn btn-ghost btn-sm"
                          disabled={voidLoading}
                          style={{ flex: 1, fontSize: "0.78rem" }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVoidPayment(payment.id)}
                          className="btn btn-sm"
                          disabled={voidLoading || voidReason.trim().length < 5}
                          style={{ flex: 2, fontSize: "0.78rem", background: "#ef4444", color: "#fff", border: "none" }}
                        >
                          {voidLoading ? "Anulando..." : "Confirmar anulación"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pie del modal */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ minWidth: 100 }}
          >
            Cerrar
          </button>
        </div>

        {!isAdmin && payments.some((p) => p.status === "verified") && (
          <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
            Solo el administrador puede anular movimientos financieros.
          </p>
        )}
      </div>
    </div>
  );
}
