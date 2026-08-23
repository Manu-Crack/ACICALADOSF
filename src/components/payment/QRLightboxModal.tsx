"use client";

import { useState } from "react";

interface QRLightboxModalProps {
  qrImageUrl: string | null;
  recipientName: string;
  yapePhone: string;
  onClose: () => void;
}

export function QRLightboxModal({
  qrImageUrl,
  recipientName,
  yapePhone,
  onClose,
}: QRLightboxModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyPhone = () => {
    if (!yapePhone) return;
    navigator.clipboard.writeText(yapePhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Código QR de Yape ampliado"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "24px",
          textAlign: "center",
          position: "relative",
          background: "#16130D",
          border: "2px solid var(--color-primary)",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.8)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            padding: "4px 8px",
            fontSize: "1.1rem",
            lineHeight: 1,
            color: "var(--color-text-muted)",
          }}
          aria-label="Cerrar vista de QR"
        >
          ✕
        </button>

        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 800,
            color: "var(--color-primary)",
            margin: "0 0 6px",
            letterSpacing: "0.02em",
          }}
        >
          💜 Código QR Yape
        </h3>
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 16 }}>
          Escanea desde tu app Yape para realizar el pago
        </p>

        {/* QR Container */}
        <div
          style={{
            background: "#FFFFFF",
            padding: "16px",
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
            marginBottom: 16,
            width: 240,
            height: 240,
            margin: "0 auto 16px",
          }}
        >
          {qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt="QR Yape de Acicalados"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#4A154B",
                textAlign: "center",
                padding: "8px",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: 4 }}>💜</div>
              <p style={{ fontSize: "0.85rem", fontWeight: 800, margin: 0 }}>YAPE ACICALADOS</p>
              <p style={{ fontSize: "0.75rem", color: "#666", marginTop: 4 }}>
                {yapePhone}
              </p>
            </div>
          )}
        </div>

        {/* Recipient details */}
        <div
          style={{
            background: "rgba(200, 164, 92, 0.08)",
            border: "1px solid rgba(200, 164, 92, 0.2)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            marginBottom: 16,
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Titular:</span>
            <strong style={{ fontSize: "0.875rem", color: "var(--color-text)" }}>{recipientName}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Número Yape:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-primary)" }}>
                {yapePhone}
              </code>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="btn btn-ghost btn-sm"
                style={{ padding: "2px 6px", fontSize: "0.72rem" }}
                title="Copiar número"
              >
                {copied ? "✅ Copiado" : "📋 Copiar"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
