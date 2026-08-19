"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: "spa" | "barberia" | "recepcionista";
  is_active: boolean;
}

interface EmployeeQRBadgeModalProps {
  employee: Employee;
  onClose: () => void;
}

export function EmployeeQRBadgeModal({ employee, onClose }: EmployeeQRBadgeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [badgeImageUrl, setBadgeImageUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isSpa = employee.type === "spa";
  const isRecepcion = employee.type === "recepcionista";
  const typeLabel = isRecepcion ? "Personal de Recepción" : isSpa ? "Personal de Spa" : "Personal de Barbería";
  const typeColor = isRecepcion ? "#2dd4bf" : isSpa ? "#e06292" : "#C8A45C";

  // 1. Generate QR data and draw high-resolution Badge Card Canvas
  useEffect(() => {
    async function createCard() {
      setGenerating(true);
      try {
        const payload = `acicalados:emp:${employee.id}`;
        
        // Generate crisp QR code
        const qrUrl = await QRCode.toDataURL(payload, {
          width: 500,
          margin: 1,
          color: {
            dark: "#120f0a",
            light: "#ffffff",
          },
        });
        setQrDataUrl(qrUrl);

        // Load QR image element to draw onto HD canvas (800 x 1100 px)
        const qrImage = new Image();
        qrImage.crossOrigin = "anonymous";
        qrImage.src = qrUrl;
        await new Promise((resolve) => {
          qrImage.onload = resolve;
        });

        // Draw HD VIP Badge on Canvas
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 1100;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Background Gradient
          const bgGrad = ctx.createLinearGradient(0, 0, 0, 1100);
          bgGrad.addColorStop(0, "#18140c");
          bgGrad.addColorStop(0.5, "#120f0a");
          bgGrad.addColorStop(1, "#0a0805");
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, 800, 1100);

          // Outer Golden Border
          ctx.strokeStyle = "#C8A45C";
          ctx.lineWidth = 10;
          ctx.strokeRect(30, 30, 740, 1040);

          // Inner Symmetrical Golden Border
          ctx.strokeStyle = "rgba(200, 164, 92, 0.4)";
          ctx.lineWidth = 2;
          ctx.strokeRect(45, 45, 710, 1010);

          // Brand Title
          ctx.fillStyle = "#C8A45C";
          ctx.font = "bold 44px 'Playfair Display', Georgia, serif";
          ctx.textAlign = "center";
          ctx.fillText("ACICALADOS", 400, 120);

          // Subtitle
          ctx.fillStyle = "#A89984";
          ctx.font = "600 20px 'DM Sans', sans-serif";
          ctx.letterSpacing = "4px";
          ctx.fillText("SPA & BARBERÍA VIP", 400, 160);

          // Golden divider line
          ctx.strokeStyle = "rgba(200, 164, 92, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(220, 190);
          ctx.lineTo(580, 190);
          ctx.stroke();

          // Employee Name — First Name on line 1, Last Name on line 2
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 42px 'Playfair Display', Georgia, serif";
          ctx.fillText(employee.first_name, 400, 250);
          ctx.fillText(employee.last_name, 400, 300);

          // Specialty Pill Background
          const pillWidth = isRecepcion ? 330 : isSpa ? 260 : 310;
          const pillHeight = 44;
          const pillX = (800 - pillWidth) / 2;
          const pillY = 335;

          ctx.fillStyle = isRecepcion ? "rgba(45, 212, 191, 0.15)" : isSpa ? "rgba(224, 98, 146, 0.15)" : "rgba(200, 164, 92, 0.15)";
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 22);
          ctx.fill();

          ctx.strokeStyle = typeColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 22);
          ctx.stroke();

          // Specialty Text
          ctx.fillStyle = typeColor;
          ctx.font = "bold 20px 'DM Sans', sans-serif";
          ctx.fillText(typeLabel.toUpperCase(), 400, 364);

          // QR Code Background Box
          const qrBoxSize = 440;
          const qrBoxX = (800 - qrBoxSize) / 2;
          const qrBoxY = 410;

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
          ctx.fill();

          ctx.strokeStyle = "#C8A45C";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
          ctx.stroke();

          // Draw QR image
          ctx.drawImage(qrImage, qrBoxX + 25, qrBoxY + 25, qrBoxSize - 50, qrBoxSize - 50);

          // Bottom Instruction
          ctx.fillStyle = "#E0D5BE";
          ctx.font = "600 22px 'DM Sans', sans-serif";
          ctx.fillText("CARNET OFICIAL DE ASISTENCIA", 400, 910);

          ctx.fillStyle = "#8C8273";
          ctx.font = "18px monospace";
          ctx.fillText(`ID: ${employee.id}`, 400, 950);

          ctx.fillStyle = "rgba(200, 164, 92, 0.6)";
          ctx.font = "16px 'DM Sans', sans-serif";
          ctx.fillText("Válido para marcación de entrada y salida diaria", 400, 990);

          const fullBadgeDataUrl = canvas.toDataURL("image/png");
          setBadgeImageUrl(fullBadgeDataUrl);
        }
      } catch (err) {
        console.error("Error generating badge card:", err);
      } finally {
        setGenerating(false);
      }
    }

    createCard();
  }, [employee]);

  // 2. Download Full Badge Card Image
  function handleDownloadBadge() {
    if (!badgeImageUrl) return;
    const link = document.createElement("a");
    link.href = badgeImageUrl;
    link.download = `Carnet-QR-${employee.first_name}-${employee.last_name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 3. Share via WhatsApp / Native Share API
  async function handleShareWhatsApp() {
    const textMsg = `Hola ${employee.first_name}, aquí tienes tu Carnet QR de Asistencia para Acicalados. Muestralo al ingresar y al salir de tu turno.`;

    if (navigator.share && badgeImageUrl) {
      try {
        const response = await fetch(badgeImageUrl);
        const blob = await response.blob();
        const file = new File([blob], `Carnet-QR-${employee.first_name}.png`, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Carnet QR - ${employee.first_name} ${employee.last_name}`,
            text: textMsg,
            files: [file],
          });
          return;
        }
      } catch (err) {
        console.log("Native share fallback to WhatsApp Web link:", err);
      }
    }

    // Fallback: Download image and open WhatsApp Web with pre-filled message
    handleDownloadBadge();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, "_blank");
  }

  // 4. Copy Image to Clipboard
  async function handleCopyImage() {
    if (!badgeImageUrl) return;
    try {
      const response = await fetch(badgeImageUrl);
      const blob = await response.blob();
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        handleDownloadBadge();
      }
    } catch {
      handleDownloadBadge();
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
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
          maxWidth: 440,
          maxHeight: "92vh",
          boxShadow: "var(--shadow-elevated)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
            <span style={{ fontSize: "1.35rem" }}>🪪</span>
            <div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                Carnet de Asistencia QR
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Listo para descargar o compartir por WhatsApp
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

        {/* Badge Visual Card Preview */}
        <div
          style={{
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {generating ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <p className="text-muted">Generando carnet en alta definición...</p>
            </div>
          ) : badgeImageUrl ? (
            <div
              id="print-qr-badge"
              style={{
                width: "100%",
                maxWidth: 320,
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: "0 12px 35px rgba(0,0,0,0.85), 0 0 15px rgba(200,164,92,0.3)",
                border: "2px solid var(--color-primary-border)",
                lineHeight: 0,
              }}
            >
              <img
                src={badgeImageUrl}
                alt={`Carnet QR de ${employee.first_name}`}
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {/* Main Action Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="btn btn-primary btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#25D366",
                color: "#ffffff",
                borderColor: "#1ebe5d",
                fontWeight: 700,
              }}
              title="Compartir tarjeta por WhatsApp"
            >
              <img src="/icons/WhatsApp.svg" alt="WhatsApp" style={{ width: 16, height: 16 }} />
              WhatsApp
            </button>

            {/* Download Badge PNG Button */}
            <button
              type="button"
              onClick={handleDownloadBadge}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              📥 Descargar PNG
            </button>
          </div>

          {/* Secondary Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleCopyImage}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", padding: "6px 10px" }}
            >
              {copied ? "✅ ¡Copiado!" : "📋 Copiar Imagen"}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", padding: "6px 10px" }}
              >
                🖨️ Imprimir
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", padding: "6px 10px" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
