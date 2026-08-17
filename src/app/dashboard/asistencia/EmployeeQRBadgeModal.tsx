"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: "spa" | "barberia";
  is_active: boolean;
  email?: string | null;
  phone?: string | null;
}

interface EmployeeQRBadgeModalProps {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeQRBadgeModal({ employee, onClose }: EmployeeQRBadgeModalProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const badgeRef = useRef<HTMLDivElement>(null);

  const isSpa = employee.type === "spa";
  const typeLabel = isSpa ? "Personal de Spa" : "Personal de Barbería";
  const typeColor = isSpa ? "#e06292" : "var(--color-primary)";

  useEffect(() => {
    // Generate high resolution QR code containing unique system format
    const payload = `acicalados:emp:${employee.id}`;
    QRCode.toDataURL(payload, {
      width: 400,
      margin: 1,
      color: {
        dark: "#120f0a",
        light: "#ffffff",
      },
    })
      .then((url: string) => setQrUrl(url))
      .catch((err: unknown) => console.error("Error generating QR:", err));
  }, [employee.id]);

  function handleDownload() {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `QR-Asistencia-${employee.first_name}-${employee.last_name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-primary-border)",
          borderRadius: "var(--radius-lg)",
          width: "100%",
          maxWidth: 420,
          boxShadow: "var(--shadow-elevated)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(200, 164, 92, 0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.25rem" }}>🪪</span>
            <div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                Carnet de Asistencia QR
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Código único para marcación en entrada/salida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: "1.25rem",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Badge Card Container */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            ref={badgeRef}
            id="print-qr-badge"
            style={{
              width: "100%",
              maxWidth: 320,
              background: "linear-gradient(170deg, #18140c 0%, #0d0a06 100%)",
              border: "2px solid rgba(200, 164, 92, 0.4)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 20px",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(200,164,92,0.2)",
              position: "relative",
            }}
          >
            {/* Brand Title */}
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "var(--color-primary)",
                  letterSpacing: "0.08em",
                  display: "block",
                }}
              >
                ACICALADOS
              </span>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--color-text-dim)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Spa &amp; Barbería VIP
              </span>
            </div>

            {/* Employee Name */}
            <h4
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#ffffff",
                margin: "8px 0 4px 0",
              }}
            >
              {employee.first_name} {employee.last_name}
            </h4>

            {/* Specialty Badge */}
            <span
              style={{
                display: "inline-block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: typeColor,
                background: isSpa ? "rgba(224, 98, 146, 0.12)" : "rgba(200, 164, 92, 0.12)",
                border: `1px solid ${isSpa ? "rgba(224, 98, 146, 0.3)" : "rgba(200, 164, 92, 0.3)"}`,
                padding: "3px 12px",
                borderRadius: "9999px",
                marginBottom: 16,
              }}
            >
              {typeLabel}
            </span>

            {/* QR Code Container */}
            <div
              style={{
                background: "#ffffff",
                padding: 12,
                borderRadius: "var(--radius-md)",
                display: "inline-block",
                border: "2px solid var(--color-primary)",
                boxShadow: "0 4px 14px rgba(200,164,92,0.25)",
                marginBottom: 12,
              }}
            >
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR de ${employee.first_name}`}
                  style={{ width: 190, height: 190, display: "block" }}
                />
              ) : (
                <div
                  style={{
                    width: 190,
                    height: 190,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#333",
                    fontSize: "0.875rem",
                  }}
                >
                  Generando QR...
                </div>
              )}
            </div>

            {/* ID Code display */}
            <p
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text-dim)",
                fontFamily: "monospace",
                margin: 0,
                letterSpacing: "0.05em",
              }}
            >
              ID: {employee.id.slice(0, 13)}...
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.2)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleDownload}
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            📥 Descargar PNG
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
