"use client";

import { useState, useEffect, useCallback } from "react";
import { QRLightboxModal } from "./QRLightboxModal";
import { PaymentProofUploadModal } from "./PaymentProofUploadModal";
import {
  generateWhatsAppAdvanceUrl,
  generateWhatsAppBalanceUrl,
  generateWhatsAppFullPaymentUrl,
  type WhatsAppPaymentMessageType,
} from "@/lib/utils/whatsapp";
import { DEFAULT_PAYMENT_SETTINGS, type PaymentSettings } from "@/lib/types/settings";

interface PaymentQRWidgetProps {
  bookingId?: string;
  bookingCode: string;
  serviceNames: string | string[];
  totalPriceCents: number;
  advancePercentage?: number;
  amountPaidCents?: number;
  balanceCents?: number;
  clientName?: string;
  bookingDate?: string;
  startTime?: string;
  messageType?: WhatsAppPaymentMessageType;
  showUploadButton?: boolean;
  showWhatsAppButton?: boolean;
  compact?: boolean;
  onProofUploaded?: () => void;
}

export function PaymentQRWidget({
  bookingId,
  bookingCode,
  serviceNames,
  totalPriceCents,
  advancePercentage,
  amountPaidCents = 0,
  balanceCents,
  clientName = "Cliente",
  bookingDate = "",
  startTime = "",
  messageType = "advance",
  showUploadButton = true,
  showWhatsAppButton = true,
  compact = false,
  onProofUploaded,
}: PaymentQRWidgetProps) {
  const [settings, setSettings] = useState<PaymentSettings>({
    id: 1,
    ...DEFAULT_PAYMENT_SETTINGS,
    qr_image_url: null,
    updated_at: "",
    updated_by: null,
  });

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const effectiveRecipientName = settings.recipient_name || DEFAULT_PAYMENT_SETTINGS.recipient_name;
  const effectiveYapePhone = settings.yape_phone || DEFAULT_PAYMENT_SETTINGS.yape_phone;
  const effectiveQrImageUrl = settings.qr_image_url || "/qr-yape.png";

  // Cargar configuración de pago centralizada
  useEffect(() => {
    let isMounted = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/payment-settings");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.settings) {
            setSettings(data.settings);
          }
        }
      } catch (err) {
        console.error("Error al cargar payment_settings:", err);
      }
    }
    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveAdvancePct = advancePercentage || settings.advance_percentage || 25;
  const advanceRequiredCents = Math.ceil((totalPriceCents * effectiveAdvancePct) / 100);
  const effectiveBalanceCents =
    balanceCents !== undefined ? balanceCents : Math.max(0, totalPriceCents - amountPaidCents);

  const totalSoles = (totalPriceCents / 100).toFixed(2);
  const advanceSoles = (advanceRequiredCents / 100).toFixed(2);
  const paidSoles = (amountPaidCents / 100).toFixed(2);
  const balanceSoles = (effectiveBalanceCents / 100).toFixed(2);

  const handleCopy = () => {
    if (!effectiveYapePhone) return;
    navigator.clipboard.writeText(effectiveYapePhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Generar URL contextual de WhatsApp
  const getWhatsAppUrl = useCallback(() => {
    const servicesStr = Array.isArray(serviceNames) ? serviceNames.join(", ") : serviceNames;

    if (messageType === "balance" || (amountPaidCents > 0 && effectiveBalanceCents > 0)) {
      return generateWhatsAppBalanceUrl({
        bookingCode,
        clientName,
        totalPriceSoles: totalSoles,
        amountPaidSoles: paidSoles,
        balanceSoles: balanceSoles,
        whatsappNumber: effectiveYapePhone,
      });
    }

    if (messageType === "full" || amountPaidCents >= totalPriceCents) {
      return generateWhatsAppFullPaymentUrl({
        bookingCode,
        clientName,
        services: servicesStr,
        totalPriceSoles: totalSoles,
        whatsappNumber: effectiveYapePhone,
      });
    }

    return generateWhatsAppAdvanceUrl({
      bookingCode,
      clientName,
      services: servicesStr,
      bookingDate,
      startTime,
      totalPriceSoles: totalSoles,
      advancePercentage: effectiveAdvancePct,
      advanceAmountSoles: advanceSoles,
      balanceSoles: balanceSoles,
      whatsappNumber: effectiveYapePhone,
    });
  }, [
    messageType,
    bookingCode,
    clientName,
    serviceNames,
    bookingDate,
    startTime,
    totalSoles,
    paidSoles,
    balanceSoles,
    advanceSoles,
    effectiveAdvancePct,
    amountPaidCents,
    totalPriceCents,
    effectiveBalanceCents,
    effectiveYapePhone,
  ]);

  return (
    <div
      className="card card-gold"
      style={{
        padding: compact ? "14px 16px" : "20px 22px",
        background: "rgba(18, 15, 10, 0.75)",
        border: "1px solid rgba(200, 164, 92, 0.35)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: 10,
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1.2rem" }}>💜</span>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text)" }}>
              Pago por Yape
            </h4>
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
              Titular: <strong>{effectiveRecipientName}</strong>
            </span>
          </div>
        </div>

        {bookingCode && (
          <code
            style={{
              color: "var(--color-primary)",
              fontWeight: 800,
              fontSize: "0.9rem",
              background: "rgba(200, 164, 92, 0.08)",
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(200, 164, 92, 0.25)",
            }}
          >
            {bookingCode}
          </code>
        )}
      </div>

      {/* Main Grid: QR Preview + Financial Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "auto 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        {/* QR Code Container */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            onClick={() => setLightboxOpen(true)}
            style={{
              width: compact ? 110 : 130,
              height: compact ? 110 : 130,
              background: "#FFFFFF",
              borderRadius: "var(--radius-sm)",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              border: "1px solid rgba(200,164,92,0.4)",
              transition: "transform 0.15s ease",
            }}
            title="Haz clic para ampliar el QR"
          >
            <img
              src={effectiveQrImageUrl}
              alt="QR Yape"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              onError={(event) => {
                const target = event.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = "/qr-yape.png";
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "0.72rem", padding: "2px 6px" }}
          >
            🔍 Ampliar QR
          </button>
        </div>

        {/* Financial Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              background: "rgba(200, 164, 92, 0.05)",
              border: "1px solid rgba(200, 164, 92, 0.15)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 12px",
            }}
          >
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", margin: 0, textTransform: "uppercase" }}>
                Total servicio
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                S/ {totalSoles}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", margin: 0, textTransform: "uppercase" }}>
                Adelanto req. ({effectiveAdvancePct}%)
              </p>
              <p style={{ fontSize: "0.9rem", fontWeight: 800, margin: 0, color: "#F59E0B" }}>
                S/ {advanceSoles}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", margin: 0, textTransform: "uppercase" }}>
                Total pagado
              </p>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0, color: amountPaidCents > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                S/ {paidSoles}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", margin: 0, textTransform: "uppercase" }}>
                Saldo en local
              </p>
              <p style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0, color: effectiveBalanceCents > 0 ? "#EF4444" : "var(--color-success)" }}>
                S/ {balanceSoles}
              </p>
            </div>
          </div>

          {/* Quick Copy Number */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.78rem",
              padding: "4px 8px",
              background: "rgba(0,0,0,0.25)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ color: "var(--color-text-muted)" }}>
              Número Yape: <strong style={{ color: "var(--color-text)" }}>{effectiveYapePhone}</strong>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.7rem", padding: "1px 6px" }}
            >
              {copiedPhone ? "✅ Copiado" : "📋 Copiar"}
            </button>
          </div>

          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--color-text)",
              textAlign: "center",
              padding: "8px 10px 0",
            }}
          >
            {effectiveRecipientName}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {showWhatsAppButton && (
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            style={{
              flex: "1 1 140px",
              background: "#25D366",
              color: "#FFFFFF",
              border: "none",
              fontWeight: 700,
              fontSize: "0.8rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              textDecoration: "none",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
            }}
            id={`whatsapp-btn-${bookingCode || "qr"}`}
          >
            <img src="/icons/whatsApp.svg" alt="WhatsApp" style={{ width: 16, height: 16 }} />
            <span>Enviar por WhatsApp</span>
          </a>
        )}

        {showUploadButton && bookingId && (
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{
              flex: "1 1 130px",
              fontSize: "0.8rem",
              padding: "8px 12px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            id={`upload-proof-btn-${bookingCode || "qr"}`}
          >
            <span>📸 Subir Comprobante</span>
          </button>
        )}
      </div>

      {/* Notice regarding manual attachment */}
      <p
        style={{
          fontSize: "0.72rem",
          color: "var(--color-text-muted)",
          marginTop: 10,
          marginBottom: 0,
          lineHeight: 1.35,
          fontStyle: "italic",
        }}
      >
        💡 Recuerda adjuntar la captura del comprobante al enviar el mensaje de WhatsApp. Tu reserva será confirmada una vez verificado el abono.
      </p>

      {/* Modals */}
      {lightboxOpen && (
        <QRLightboxModal
          qrImageUrl={effectiveQrImageUrl}
          recipientName={effectiveRecipientName}
          yapePhone={effectiveYapePhone}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {uploadModalOpen && bookingId && (
        <PaymentProofUploadModal
          bookingId={bookingId}
          bookingCode={bookingCode}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            setUploadModalOpen(false);
            onProofUploaded?.();
          }}
        />
      )}
    </div>
  );
}
