"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  PaymentMethod,
  PaymentType,
} from "@/lib/types/payments";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/types/payments";
import { QRLightboxModal } from "@/components/payment/QRLightboxModal";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "@/lib/types/settings";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface BookingSummary {
  id: string;
  booking_code: string;
  client_first_name: string;
  client_last_name: string;
  total_price_cents: number;
  advance_percentage: number;
  advance_required_cents: number;
  amount_paid_cents: number;
  balance_cents: number;
  payment_status: string;
  booking_status: string;
}

interface PaymentModalProps {
  booking: BookingSummary;
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Constantes UI
// ---------------------------------------------------------------------------

const PAYMENT_METHODS: PaymentMethod[] = ["yape", "cash", "mixed"];

function getAvailablePaymentTypes(
  amountPaid: number,
  totalPrice: number,
  advanceRequired: number,
  inputAmount: number
): { type: PaymentType; label: string }[] {
  const remaining = totalPrice - amountPaid;
  const types: { type: PaymentType; label: string }[] = [];

  if (amountPaid === 0) {
    if (advanceRequired < totalPrice) {
      types.push({ type: "advance", label: PAYMENT_TYPE_LABELS.advance });
    }
  } else if (amountPaid > 0 && amountPaid < totalPrice) {
    types.push({ type: "partial", label: PAYMENT_TYPE_LABELS.partial });
    if (inputAmount >= remaining) {
      types.push({ type: "balance", label: PAYMENT_TYPE_LABELS.balance });
    }
  }

  if (inputAmount >= totalPrice - amountPaid && inputAmount > 0) {
    types.push({ type: "full", label: PAYMENT_TYPE_LABELS.full });
  }

  return types.length > 0 ? types : [{ type: "partial", label: PAYMENT_TYPE_LABELS.partial }];
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PaymentModal({
  booking,
  userRole,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const isAdmin = userRole === "admin";

  // Estado del formulario
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paymentType, setPaymentType] = useState<PaymentType>("advance");
  const [rawAmount, setRawAmount] = useState<string>("");
  const [rawYape, setRawYape] = useState<string>("");
  const [rawCash, setRawCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>({
    id: 1,
    ...DEFAULT_PAYMENT_SETTINGS,
    qr_image_url: null,
    updated_at: "",
    updated_by: null,
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/payment-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) setSettings(data.settings);
        }
      } catch (err) {
        console.error("Error fetching payment settings:", err);
      }
    }
    fetchSettings();
  }, []);

  // Calcular valores numéricos en centavos
  const amountCents = Math.round((parseFloat(rawAmount) || 0) * 100);
  const yapeCents   = Math.round((parseFloat(rawYape)   || 0) * 100);
  const cashCents   = Math.round((parseFloat(rawCash)   || 0) * 100);

  const maxAllowed = booking.balance_cents;

  // Sincronizar tipo de pago según contexto
  const availableTypes = getAvailablePaymentTypes(
    booking.amount_paid_cents,
    booking.total_price_cents,
    booking.advance_required_cents,
    amountCents
  );

  useEffect(() => {
    if (availableTypes.length > 0) {
      const current = availableTypes.find((t) => t.type === paymentType);
      if (!current) {
        setPaymentType(availableTypes[0].type);
      }
    }
  }, [amountCents, availableTypes, paymentType]);

  // En mixto: sincronizar total
  useEffect(() => {
    if (method === "mixed") {
      const total = yapeCents + cashCents;
      setRawAmount((total / 100).toFixed(2));
    }
  }, [method, yapeCents, cashCents]);

  // Validaciones en tiempo real
  const mixedSumError = method === "mixed" && amountCents > 0 && yapeCents + cashCents !== amountCents;
  const mixedZeroError = method === "mixed" && amountCents > 0 && (yapeCents === 0 || cashCents === 0);
  const exceedsBalance = amountCents > maxAllowed;
  const belowMinimum = amountCents <= 0;

  const canSubmit =
    !belowMinimum &&
    !exceedsBalance &&
    !mixedSumError &&
    !mixedZeroError &&
    (method !== "mixed" || (yapeCents > 0 && cashCents > 0));

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMethodChange = useCallback((newMethod: PaymentMethod) => {
    setMethod(newMethod);
    setRawYape("");
    setRawCash("");
    if (newMethod !== "mixed") {
      // el amount queda como ingresado
    }
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);

    if (belowMinimum) {
      setError("El monto debe ser mayor a cero.");
      return;
    }
    if (exceedsBalance) {
      setError(`El monto supera el saldo pendiente (S/ ${(maxAllowed / 100).toFixed(2)}).`);
      return;
    }
    if (method === "mixed" && (yapeCents + cashCents !== amountCents)) {
      setError(`La suma Yape + Efectivo (S/ ${((yapeCents + cashCents) / 100).toFixed(2)}) debe ser igual al total (S/ ${(amountCents / 100).toFixed(2)}).`);
      return;
    }
    if (method === "mixed" && (yapeCents === 0 || cashCents === 0)) {
      setError("Para pago mixto, ambos montos deben ser mayores a cero.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: booking.id,
          amount_cents: amountCents,
          payment_method: method,
          payment_type: paymentType,
          yape_amount_cents: method === "yape" ? amountCents : (method === "mixed" ? yapeCents : 0),
          cash_amount_cents: method === "cash" ? amountCents : (method === "mixed" ? cashCents : 0),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar el pago.");
        return;
      }

      setSuccess(data.message || "Pago registrado exitosamente.");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch {
      setError("Error de conexión al registrar el pago. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [
    belowMinimum, exceedsBalance, method, yapeCents, cashCents,
    amountCents, maxAllowed, booking.id, paymentType, notes, onSuccess, onClose,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const advanceRequired = booking.advance_required_cents;
  const amountPaid      = booking.amount_paid_cents;
  const balance         = booking.balance_cents;
  const total           = booking.total_price_cents;
  const advancePct      = booking.advance_percentage || 25;

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
          maxWidth: 520,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "28px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          border: "1px solid var(--color-border)",
          background: "var(--color-bg-card)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Registrar pago para reserva ${booking.booking_code}`}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
              💳 Registrar Pago
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              {booking.booking_code} · {booking.client_first_name} {booking.client_last_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px", fontSize: "1rem", lineHeight: 1 }}
            aria-label="Cerrar modal de pago"
          >
            ✕
          </button>
        </div>

        {/* Resumen financiero */}
        <div
          style={{
            background: "rgba(200,164,92,0.06)",
            border: "1px solid rgba(200,164,92,0.2)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 16px",
          }}
        >
          {[
            { label: "Total del servicio",              value: `S/ ${(total / 100).toFixed(2)}`,         color: "var(--color-text)" },
            { label: `Adelanto requerido (${advancePct}%)`, value: `S/ ${(advanceRequired / 100).toFixed(2)}`, color: "#f59e0b" },
            { label: "Total pagado",                    value: `S/ ${(amountPaid / 100).toFixed(2)}`,   color: amountPaid > 0 ? "var(--color-success)" : "var(--color-text-muted)" },
            { label: "Saldo pendiente",                 value: `S/ ${(balance / 100).toFixed(2)}`,    color: balance > 0 ? "#ef4444" : "var(--color-success)" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Selector de método */}
        <div>
          <label className="label" style={{ marginBottom: 8 }}>Método de pago</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleMethodChange(m)}
                style={{
                  flex: "1 1 120px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: method === m
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                  background: method === m
                    ? "rgba(200,164,92,0.12)"
                    : "var(--color-bg-input)",
                  color: method === m ? "var(--color-primary)" : "var(--color-text)",
                  fontWeight: method === m ? 700 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
                aria-pressed={method === m}
              >
                {PAYMENT_METHOD_ICONS[m]} {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Banner de información de cuenta Yape cuando aplica */}
        {(method === "yape" || method === "mixed") && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(106, 27, 154, 0.08)",
              border: "1px solid rgba(106, 27, 154, 0.25)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                💜 Yape: <strong style={{ color: "var(--color-text)" }}>{settings.recipient_name}</strong> · {settings.yape_phone}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.72rem", padding: "2px 8px" }}
            >
              🔍 Ver QR
            </button>
          </div>
        )}

        {/* Campos de monto según método */}
        {method === "mixed" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Monto Yape */}
              <div>
                <label className="label" htmlFor="yape-amount">
                  💜 Monto Yape (S/)
                </label>
                <input
                  id="yape-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="0.00"
                  value={rawYape}
                  onChange={(e) => setRawYape(e.target.value)}
                />
              </div>
              {/* Monto Efectivo */}
              <div>
                <label className="label" htmlFor="cash-amount">
                  💵 Monto Efectivo (S/)
                </label>
                <input
                  id="cash-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="0.00"
                  value={rawCash}
                  onChange={(e) => setRawCash(e.target.value)}
                />
              </div>
            </div>
            {/* Total calculado automáticamente */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: mixedSumError || mixedZeroError
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(200,164,92,0.06)",
                border: `1px solid ${mixedSumError || mixedZeroError ? "rgba(239,68,68,0.4)" : "rgba(200,164,92,0.2)"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                Total calculado:
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: mixedSumError ? "#ef4444" : "var(--color-primary)",
                }}
              >
                S/ {((yapeCents + cashCents) / 100).toFixed(2)}
              </span>
            </div>
            {mixedZeroError && (
              <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: 0 }}>
                ⚠️ Ambos montos deben ser mayores a cero para pago mixto.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="payment-amount">
              {method === "yape" ? "💜" : "💵"} Monto a pagar (S/)
            </label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              max={(maxAllowed / 100).toFixed(2)}
              step="0.01"
              className="input"
              style={{ width: "100%", fontSize: "1.1rem", padding: "10px 14px" }}
              placeholder={`Máx. S/ ${(maxAllowed / 100).toFixed(2)}`}
              value={rawAmount}
              onChange={(e) => setRawAmount(e.target.value)}
            />
            {exceedsBalance && (
              <p style={{ fontSize: "0.78rem", color: "#ef4444", marginTop: 4 }}>
                ⚠️ El monto supera el saldo pendiente (S/ {(maxAllowed / 100).toFixed(2)}).
              </p>
            )}
          </div>
        )}

        {/* Tipo de pago */}
        <div>
          <label className="label" htmlFor="payment-type">Tipo de movimiento</label>
          <select
            id="payment-type"
            className="select"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
            style={{ width: "100%" }}
          >
            {availableTypes.map(({ type, label }) => (
              <option key={type} value={type}>{label}</option>
            ))}
          </select>
        </div>

        {/* Notas opcionales */}
        <div>
          <label className="label" htmlFor="payment-notes">Notas (opcional)</label>
          <textarea
            id="payment-notes"
            className="input"
            rows={2}
            placeholder="Referencia del pago, número de operación Yape, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Previsualización del pago */}
        {amountCents > 0 && !exceedsBalance && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(106,153,78,0.06)",
              border: "1px solid rgba(106,153,78,0.2)",
              fontSize: "0.82rem",
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
            }}
          >
            {method === "mixed" && yapeCents > 0 && cashCents > 0 && yapeCents + cashCents === amountCents ? (
              <>
                ✅ Pago mixto: <strong>S/ {(yapeCents / 100).toFixed(2)} Yape</strong> + <strong>S/ {(cashCents / 100).toFixed(2)} Efectivo</strong> = <strong>S/ {(amountCents / 100).toFixed(2)}</strong>
              </>
            ) : method !== "mixed" ? (
              <>✅ Monto a registrar: <strong>S/ {(amountCents / 100).toFixed(2)}</strong> en {PAYMENT_METHOD_LABELS[method]}</>
            ) : null}
            {amountPaid + amountCents >= advanceRequired && booking.booking_status === "pendiente" && (
              <p style={{ marginTop: 6, color: "var(--color-success)", fontWeight: 600 }}>
                🎉 Con este pago la reserva se confirmará automáticamente.
              </p>
            )}
          </div>
        )}

        {/* Mensajes de error/éxito */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              fontSize: "0.83rem",
            }}
          >
            ❌ {error}
          </div>
        )}
        {success && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(106,153,78,0.1)",
              border: "1px solid rgba(106,153,78,0.3)",
              color: "var(--color-success)",
              fontSize: "0.83rem",
              fontWeight: 600,
            }}
          >
            ✅ {success}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            disabled={loading}
            style={{ flex: 1 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={!canSubmit || loading || !!success}
            style={{ flex: 2 }}
            id="payment-submit-btn"
          >
            {loading ? "Registrando..." : `Registrar S/ ${(amountCents / 100).toFixed(2)}`}
          </button>
        </div>

        {!isAdmin && (
          <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
            Solo admin puede anular movimientos financieros.
          </p>
        )}
      </div>

      {lightboxOpen && (
        <QRLightboxModal
          qrImageUrl={settings.qr_image_url}
          recipientName={settings.recipient_name}
          yapePhone={settings.yape_phone}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
