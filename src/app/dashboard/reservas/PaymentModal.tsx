"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaymentMethod } from "@/lib/types/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from "@/lib/types/payments";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type SelectablePaymentMethod = "yape" | "efectivo" | "transferencia" | "mixto";

interface BookingSummary {
  id: string;
  booking_code: string;
  client_first_name: string;
  client_last_name: string;
  total_price_cents: number;
  advance_percentage?: number;
  advance_required_cents?: number;
  amount_paid_cents?: number;
  balance_cents?: number;
  payment_status?: string;
  booking_status?: string;
  payment_method?: string | null;
}

interface PaymentModalProps {
  booking: BookingSummary;
  userRole?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentOption {
  id: SelectablePaymentMethod;
  name: string;
  description: string;
  icon: string;
  badge?: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "yape",
    name: "Yape",
    description: "Cobro mediante App Yape o código QR",
    icon: "💜",
  },
  {
    id: "efectivo",
    name: "Efectivo",
    description: "Pago físico en billetes / monedas en caja",
    icon: "💵",
  },
  {
    id: "transferencia",
    name: "Transferencia",
    description: "Transferencia bancaria directa (BCP, BBVA, Interbank, Plin)",
    icon: "🏦",
  },
  {
    id: "mixto",
    name: "Mixto (Yape y Efectivo)",
    description: "Combinación de parte en Yape y parte en Efectivo",
    icon: "🔄",
  },
];

// ---------------------------------------------------------------------------
// Componente principal: Selector y confirmación de método de pago
// ---------------------------------------------------------------------------

export function PaymentModal({
  booking,
  userRole = "admin",
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<SelectablePaymentMethod | null>(
    (booking.payment_method as SelectablePaymentMethod) || null
  );

  const totalCents = booking.total_price_cents || 0;
  const balanceCents = booking.balance_cents !== undefined && booking.balance_cents > 0
    ? booking.balance_cents
    : totalCents;

  const targetAmountCents = balanceCents > 0 ? balanceCents : totalCents;
  const targetAmountSoles = (targetAmountCents / 100).toFixed(2);

  // Estados para desglose Mixto
  const [rawYape, setRawYape] = useState<string>(
    selectedMethod === "mixto" ? ((targetAmountCents / 2) / 100).toFixed(2) : ""
  );
  const [rawCash, setRawCash] = useState<string>(
    selectedMethod === "mixto" ? ((targetAmountCents / 2) / 100).toFixed(2) : ""
  );
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Al seleccionar "mixto", pre-llenar 50% si está vacío
  const handleSelectOption = (methodId: SelectablePaymentMethod) => {
    setSelectedMethod(methodId);
    setError(null);

    if (methodId === "mixto" && (!rawYape || !rawCash)) {
      const half = Math.floor(targetAmountCents / 200);
      const remaining = Number((targetAmountCents / 100 - half).toFixed(2));
      setRawYape(half.toFixed(2));
      setRawCash(remaining.toFixed(2));
    }
  };

  const yapeCents = Math.round((parseFloat(rawYape) || 0) * 100);
  const cashCents = Math.round((parseFloat(rawCash) || 0) * 100);

  // Validaciones
  const isMixed = selectedMethod === "mixto";
  const mixedSumValid = !isMixed || (yapeCents + cashCents === targetAmountCents && yapeCents > 0 && cashCents > 0);
  const isFormValid = selectedMethod !== null && (!isMixed || mixedSumValid);

  // Envío del registro de pago
  const handleConfirm = useCallback(async () => {
    if (!selectedMethod) {
      setError("Por favor selecciona un método de pago antes de continuar.");
      return;
    }

    if (isMixed) {
      if (yapeCents <= 0 || cashCents <= 0) {
        setError("Para pago mixto, tanto el monto de Yape como el de Efectivo deben ser mayores a S/ 0.00.");
        return;
      }
      if (yapeCents + cashCents !== targetAmountCents) {
        setError(
          `La suma de Yape (S/ ${(yapeCents / 100).toFixed(2)}) y Efectivo (S/ ${(cashCents / 100).toFixed(2)}) debe ser igual al total a cobrar (S/ ${targetAmountSoles}).`
        );
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          amount_cents: targetAmountCents,
          payment_method: selectedMethod,
          payment_type: "full",
          yape_amount_cents: selectedMethod === "yape" ? targetAmountCents : isMixed ? yapeCents : 0,
          cash_amount_cents: selectedMethod === "efectivo" ? targetAmountCents : isMixed ? cashCents : 0,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar el pago. Intenta nuevamente.");
        return;
      }

      setSuccess(`✅ ¡Cobro registrado con éxito como ${PAYMENT_METHOD_LABELS[selectedMethod] || selectedMethod}!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch {
      setError("Error de conexión al procesar el cobro. Por favor verifica tu conexión a internet.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedMethod,
    isMixed,
    yapeCents,
    cashCents,
    targetAmountCents,
    targetAmountSoles,
    notes,
    booking.id,
    onSuccess,
    onClose,
  ]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "24px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          border: "1px solid rgba(200, 164, 92, 0.4)",
          background: "var(--color-bg-card, #12100C)",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.7)",
          borderRadius: "var(--radius-lg, 12px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Registrar cobro para reserva ${booking.booking_code}`}
      >
        {/* Encabezado */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: 14,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.35rem" }}>💳</span>
              <h2
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: "var(--color-text)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Registrar Cobro de Reserva
              </h2>
            </div>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-muted)",
                margin: "4px 0 0 0",
              }}
            >
              Código: <strong style={{ color: "var(--color-primary)" }}>{booking.booking_code}</strong> · Cliente:{" "}
              <strong>
                {booking.client_first_name} {booking.client_last_name}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{
              padding: "4px 8px",
              fontSize: "1.1rem",
              lineHeight: 1,
              color: "var(--color-text-muted)",
            }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Monto a Cobrar */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(200, 164, 92, 0.12) 0%, rgba(200, 164, 92, 0.04) 100%)",
            border: "1px solid rgba(200, 164, 92, 0.3)",
            borderRadius: "var(--radius-md, 8px)",
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                fontWeight: 700,
                color: "var(--color-text-muted)",
                letterSpacing: "0.06em",
                display: "block",
              }}
            >
              Monto total a cobrar
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text)" }}>
              Servicio completo
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "var(--color-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              S/ {targetAmountSoles}
            </span>
          </div>
        </div>

        {/* Mensajes de Alerta / Estado */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-sm)",
              color: "#FCA5A5",
              fontSize: "0.8125rem",
              lineHeight: 1.4,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              borderRadius: "var(--radius-sm)",
              color: "#86EFAC",
              fontSize: "0.875rem",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {success}
          </div>
        )}

        {/* Selección obligatoria del método de pago (4 opciones) */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Selecciona el método de pago <span style={{ color: "var(--color-error)" }}>*</span>
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10,
            }}
          >
            {PAYMENT_OPTIONS.map((opt) => {
              const isSelected = selectedMethod === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(opt.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: isSelected
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    background: isSelected
                      ? "rgba(200, 164, 92, 0.12)"
                      : "rgba(255, 255, 255, 0.02)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    boxShadow: isSelected
                      ? "0 0 12px rgba(200, 164, 92, 0.25)"
                      : "none",
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectOption(opt.id);
                    }
                  }}
                >
                  <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 4,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "0.875rem",
                          color: isSelected ? "var(--color-primary)" : "var(--color-text)",
                        }}
                      >
                        {opt.name}
                      </strong>
                      {isSelected && (
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-primary)",
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--color-text-muted)",
                        margin: "3px 0 0 0",
                        lineHeight: 1.3,
                      }}
                    >
                      {opt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desglose condicional para Pago Mixto */}
        {isMixed && (
          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid rgba(200, 164, 92, 0.2)",
              borderRadius: "var(--radius-md)",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                  textTransform: "uppercase",
                }}
              >
                🔄 Desglose de Pago Mixto
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: mixedSumValid ? "var(--color-success)" : "var(--color-error)",
                  fontWeight: 600,
                }}
              >
                Suma: S/ {((yapeCents + cashCents) / 100).toFixed(2)} / S/ {targetAmountSoles}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label
                  className="label"
                  style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text)" }}
                >
                  💜 Monto en Yape (S/)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  max={targetAmountSoles}
                  className="input"
                  placeholder="0.00"
                  value={rawYape}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRawYape(val);
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= targetAmountCents / 100) {
                      const diff = Number((targetAmountCents / 100 - parsed).toFixed(2));
                      setRawCash(diff >= 0 ? diff.toFixed(2) : "0.00");
                    }
                  }}
                  style={{ width: "100%", fontSize: "0.9rem", padding: "8px 10px" }}
                />
              </div>

              <div>
                <label
                  className="label"
                  style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text)" }}
                >
                  💵 Monto en Efectivo (S/)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  max={targetAmountSoles}
                  className="input"
                  placeholder="0.00"
                  value={rawCash}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRawCash(val);
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= targetAmountCents / 100) {
                      const diff = Number((targetAmountCents / 100 - parsed).toFixed(2));
                      setRawYape(diff >= 0 ? diff.toFixed(2) : "0.00");
                    }
                  }}
                  style={{ width: "100%", fontSize: "0.9rem", padding: "8px 10px" }}
                />
              </div>
            </div>

            {!mixedSumValid && (
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-error)" }}>
                * La suma de Yape y Efectivo debe cuadrar exactamente con S/ {targetAmountSoles}.
              </p>
            )}
          </div>
        )}

        {/* Nota / Nro. de Operación (Opcional) */}
        <div>
          <label
            className="label"
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              marginBottom: 4,
              display: "block",
            }}
          >
            Nota / Nro. de Operación (opcional):
          </label>
          <input
            type="text"
            className="input"
            placeholder="Ej: Op. 483921 / Pago en caja 1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={150}
            style={{ width: "100%", fontSize: "0.8125rem", padding: "7px 10px" }}
          />
        </div>

        {/* Botones de Acción */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            borderTop: "1px solid var(--color-border)",
            paddingTop: 14,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            style={{ padding: "8px 16px", fontSize: "0.8125rem" }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !isFormValid}
            className="btn btn-primary btn-sm"
            style={{
              padding: "9px 20px",
              fontSize: "0.875rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: !isFormValid || loading ? 0.6 : 1,
              cursor: !isFormValid || loading ? "not-allowed" : "pointer",
            }}
            id="confirm-payment-btn"
          >
            {loading ? (
              <>⏳ Procesando cobro...</>
            ) : (
              <>
                <span>✅ Confirmar Cobro</span>
                <span style={{ opacity: 0.85 }}>(S/ {targetAmountSoles})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
