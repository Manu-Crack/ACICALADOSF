"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface AttendanceQRScannerModalProps {
  onClose: () => void;
  onScanSuccess?: () => void;
}

interface ScanResult {
  action: "check_in" | "check_out" | "already_completed" | "error";
  message: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    type: "spa" | "barberia";
  };
  timestamp?: string;
  check_in_time?: string;
  check_out_time?: string;
}

// Simple Web Audio API beep sound for feedback
function playAudioTone(type: "success" | "error") {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Audio tone fallback
  }
}

export function AttendanceQRScannerModal({ onClose, onScanSuccess }: AttendanceQRScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [selectedFacingMode, setSelectedFacingMode] = useState<"environment" | "user">("environment");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    async function startScanner() {
      try {
        setCameraError(null);
        html5QrCode = new Html5Qrcode("qr-reader-video-box", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: selectedFacingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          onCodeScanned,
          () => {
            // onScanError callback - ignored for frame-by-frame misses
          }
        );
      } catch (err: unknown) {
        console.error("Camera scanner start error:", err);
        setCameraError(
          "No se pudo acceder a la cámara. Por favor permite los permisos de cámara en tu navegador."
        );
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current && !isStoppingRef.current) {
        isStoppingRef.current = true;
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
    };
  }, [selectedFacingMode]);

  async function onCodeScanned(decodedText: string) {
    if (processing || !isScanning) return;
    setProcessing(true);
    setIsScanning(false);

    try {
      const res = await fetch("/api/admin/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: decodedText }),
      });

      const data = await res.json();

      if (res.ok) {
        playAudioTone("success");
        setLastResult({
          action: data.action,
          message: data.message,
          employee: data.employee,
          timestamp: data.timestamp,
          check_in_time: data.check_in_time,
          check_out_time: data.check_out_time,
        });
        if (onScanSuccess) {
          onScanSuccess();
        }
      } else {
        playAudioTone("error");
        setLastResult({
          action: "error",
          message: data.error || "No se pudo procesar el código QR.",
          employee: data.employee,
        });
      }
    } catch (err: unknown) {
      playAudioTone("error");
      const msg = err instanceof Error ? err.message : "Error de conexión con el servidor.";
      setLastResult({
        action: "error",
        message: msg,
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleResumeScan() {
    setLastResult(null);
    setIsScanning(true);
  }

  function toggleCamera() {
    setSelectedFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
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
          maxWidth: 480,
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
            <span style={{ fontSize: "1.25rem" }}>📷</span>
            <div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
                Escáner de Asistencia QR
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Enfoca el carnet del empleado para registrar entrada o salida
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

        {/* Video Box Container */}
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          {cameraError ? (
            <div
              style={{
                padding: "32px 20px",
                textAlign: "center",
                background: "rgba(184, 59, 46, 0.12)",
                border: "1px solid rgba(184, 59, 46, 0.3)",
                borderRadius: "var(--radius-md)",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>⚠️</span>
              <p style={{ color: "var(--color-error)", fontSize: "0.875rem", margin: 0 }}>
                {cameraError}
              </p>
              <button
                type="button"
                onClick={() => setSelectedFacingMode((prev) => (prev === "environment" ? "user" : "environment"))}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 16 }}
              >
                Reintentar Cámara
              </button>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                maxWidth: 360,
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                border: "2px solid var(--color-primary-border)",
                background: "#000",
                position: "relative",
                minHeight: 280,
              }}
            >
              {/* HTML5 QR Camera Container */}
              <div id="qr-reader-video-box" style={{ width: "100%", minHeight: 280 }} />

              {/* Gold target frame overlay */}
              {isScanning && !lastResult && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 200,
                      height: 200,
                      border: "2px solid var(--color-primary)",
                      borderRadius: 12,
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.45), 0 0 15px rgba(200,164,92,0.6)",
                      position: "relative",
                    }}
                  >
                    {/* Scanning radar line animation */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "var(--color-primary)",
                        boxShadow: "0 0 8px #C8A45C",
                        animation: "fadeInUp 1.5s infinite alternate ease-in-out",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Camera switch toggle */}
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: 12 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-dim)" }}>
              Cámara activa: {selectedFacingMode === "environment" ? "Trasera" : "Frontal"}
            </span>
            <button
              type="button"
              onClick={toggleCamera}
              className="btn btn-ghost btn-sm"
              style={{ padding: "4px 8px", fontSize: "0.75rem", display: "inline-flex", gap: 4, alignItems: "center" }}
            >
              🔄 Cambiar Cámara
            </button>
          </div>

          {/* Result Banner after scan */}
          {lastResult && (
            <div
              style={{
                width: "100%",
                marginTop: 16,
                padding: "16px",
                borderRadius: "var(--radius-md)",
                animation: "fadeIn 0.2s ease-out",
                background:
                  lastResult.action === "check_in"
                    ? "rgba(106, 153, 78, 0.15)"
                    : lastResult.action === "check_out"
                    ? "rgba(200, 164, 92, 0.15)"
                    : lastResult.action === "already_completed"
                    ? "rgba(212, 163, 76, 0.15)"
                    : "rgba(184, 59, 46, 0.15)",
                border: `1px solid ${
                  lastResult.action === "check_in"
                    ? "rgba(106, 153, 78, 0.4)"
                    : lastResult.action === "check_out"
                    ? "rgba(200, 164, 92, 0.4)"
                    : lastResult.action === "already_completed"
                    ? "rgba(212, 163, 76, 0.4)"
                    : "rgba(184, 59, 46, 0.4)"
                }`,
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "1.75rem", display: "block", marginBottom: 6 }}>
                {lastResult.action === "check_in"
                  ? "🟢"
                  : lastResult.action === "check_out"
                  ? "🟡"
                  : lastResult.action === "already_completed"
                  ? "ℹ️"
                  : "🔴"}
              </span>

              {lastResult.employee && (
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1.125rem", color: "#ffffff", fontWeight: 700 }}>
                  {lastResult.employee.first_name} {lastResult.employee.last_name}
                </h4>
              )}

              <p
                style={{
                  margin: 0,
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color:
                    lastResult.action === "check_in"
                      ? "var(--color-success)"
                      : lastResult.action === "check_out"
                      ? "var(--color-primary)"
                      : lastResult.action === "already_completed"
                      ? "var(--color-warning)"
                      : "var(--color-error)",
                }}
              >
                {lastResult.message}
              </p>

              {lastResult.timestamp && (
                <p style={{ margin: "6px 0 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                  Hora registrada: <strong>{lastResult.timestamp}</strong>
                </p>
              )}

              <button
                type="button"
                onClick={handleResumeScan}
                className="btn btn-primary btn-sm"
                style={{ marginTop: 14, width: "100%" }}
              >
                📷 Escanear Siguiente Empleado
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cerrar Escáner
          </button>
        </div>
      </div>
    </div>
  );
}
