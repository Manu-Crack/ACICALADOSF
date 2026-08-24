"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";

interface AttendanceQRScannerModalProps {
  onClose: () => void;
  onScanSuccess?: () => void;
}

interface ScanResult {
  action:
    | "check_in"
    | "check_out"
    | "temp_leave_start"
    | "temp_leave_return"
    | "requires_scan_action"
    | "requires_checkout_confirmation"
    | "already_completed"
    | "error";
  message: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    type: "spa" | "barberia" | "recepcionista";
  };
  timestamp?: string;
  check_in_time?: string;
  check_out_time?: string;
  punctuality?: string;
  reason?: string;
  duration_minutes?: number;
  temp_leave_minutes?: number;
  net_duration_minutes?: number;
}

// Audio tone synthesizer for feedback
function playAudioTone(type: "success" | "error" | "notice") {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "notice") {
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Tone fallback
  }
}

export function AttendanceQRScannerModal({ onClose, onScanSuccess }: AttendanceQRScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [pendingCode, setPendingCode] = useState<string>("");

  // Estado para formulario de motivo de salida temporal
  const [isEnteringTempLeaveReason, setIsEnteringTempLeaveReason] = useState(false);
  const [tempLeaveReasonInput, setTempLeaveReasonInput] = useState("");

  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  // 1. Process detected code safely
  const handleCodeScanned = useCallback(
    async (
      decodedText: string,
      actionType?: "temp_leave" | "final_checkout",
      tempLeaveReason?: string
    ) => {
      if (isProcessingRef.current && !actionType) return;
      isProcessingRef.current = true;
      setIsScanning(false);
      setProcessing(true);

      try {
        const payload: Record<string, unknown> = {
          code: decodedText,
        };

        if (actionType) {
          payload.action_type = actionType;
          if (actionType === "temp_leave" && tempLeaveReason) {
            payload.reason = tempLeaveReason;
          }
        }

        const res = await fetch("/api/admin/attendance/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        let data: Record<string, unknown> = {};
        try {
          data = await res.json();
        } catch {
          data = { error: "Respuesta inesperada del servidor." };
        }

        if (res.ok) {
          const action = (data.action as ScanResult["action"]) || "check_in";

          if (action === "requires_scan_action" || action === "requires_checkout_confirmation") {
            playAudioTone("notice");
            setPendingCode(decodedText);
            setIsEnteringTempLeaveReason(false);
            setTempLeaveReasonInput("");
            setLastResult({
              action: "requires_scan_action",
              message: String(
                data.message ||
                  `El empleado ya registró su entrada hoy. Seleccione la marcación a realizar:`
              ),
              employee: data.employee as ScanResult["employee"],
              check_in_time: typeof data.check_in_time === "string" ? data.check_in_time : undefined,
              timestamp: typeof data.current_time === "string" ? data.current_time : undefined,
            });
          } else {
            if (action === "temp_leave_start") {
              playAudioTone("notice");
            } else {
              playAudioTone("success");
            }

            setPendingCode("");
            setIsEnteringTempLeaveReason(false);
            setTempLeaveReasonInput("");
            setLastResult({
              action,
              message: String(data.message || "Marcación procesada con éxito."),
              employee: data.employee as ScanResult["employee"],
              timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
              check_in_time: typeof data.check_in_time === "string" ? data.check_in_time : undefined,
              check_out_time: typeof data.check_out_time === "string" ? data.check_out_time : undefined,
              punctuality: data.punctuality as ScanResult["punctuality"],
              reason: typeof data.reason === "string" ? data.reason : undefined,
              duration_minutes: typeof data.duration_minutes === "number" ? data.duration_minutes : undefined,
              temp_leave_minutes: typeof data.temp_leave_minutes === "number" ? data.temp_leave_minutes : undefined,
              net_duration_minutes: typeof data.net_duration_minutes === "number" ? data.net_duration_minutes : undefined,
            });

            if (onScanSuccess) {
              onScanSuccess();
            }
          }
        } else {
          playAudioTone("error");
          setPendingCode("");
          let errText = "No se pudo procesar la asistencia.";
          if (typeof data.error === "string") {
            errText = data.error;
          } else if (typeof data.message === "string") {
            errText = data.message;
          }

          setLastResult({
            action: "error",
            message: errText,
            employee: data.employee as ScanResult["employee"],
          });
        }
      } catch (err: unknown) {
        playAudioTone("error");
        setPendingCode("");
        const msg = err instanceof Error ? err.message : "Error de comunicación con el servidor.";
        setLastResult({
          action: "error",
          message: msg,
        });
      } finally {
        setProcessing(false);
      }
    },
    [onScanSuccess]
  );

  // 2. Camera stream lifecycle
  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        setCameraError(null);

        // Stop previous tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError("Tu navegador no soporta el acceso a la cámara.");
          return;
        }

        const videoConstraints: MediaTrackConstraints = selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } };

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // List cameras
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          if (active && videoDevices.length > 0) {
            setAvailableCameras(videoDevices);
          }
        } catch {
          // Device enumeration fallback
        }
      } catch (err: unknown) {
        console.error("Camera access error:", err);
        if (active) {
          setCameraError(
            "No se pudo acceder a la cámara. Por favor permite los permisos de cámara en tu navegador."
          );
        }
      }
    }

    startCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [selectedDeviceId, facingMode]);

  // 3. Continuous frame scanning loop
  useEffect(() => {
    let isRunning = true;

    function scanLoop() {
      if (!isRunning) return;

      const video = videoRef.current;
      if (
        isScanning &&
        !isProcessingRef.current &&
        video &&
        video.readyState === video.HAVE_ENOUGH_DATA
      ) {
        try {
          if (!canvasRef.current) {
            canvasRef.current = document.createElement("canvas");
          }
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });

          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            const scale = Math.min(1, 480 / video.videoWidth);
            canvas.width = Math.floor(video.videoWidth * scale);
            canvas.height = Math.floor(video.videoHeight * scale);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (qrCode && qrCode.data && qrCode.data.trim().length > 0) {
              handleCodeScanned(qrCode.data);
              return; // Pause scanning on detect!
            }
          }
        } catch (scanErr) {
          console.warn("Scan frame error:", scanErr);
        }
      }

      if (isRunning) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isScanning, handleCodeScanned]);

  // 4. Resume scanning
  function handleResumeScan() {
    setLastResult(null);
    setPendingCode("");
    setIsEnteringTempLeaveReason(false);
    setTempLeaveReasonInput("");
    setProcessing(false);
    isProcessingRef.current = false;
    setIsScanning(true);
  }

  // 5. Execute chosen scan action
  function handleExecuteScanAction(
    actionType: "temp_leave" | "final_checkout",
    reason?: string
  ) {
    if (!pendingCode) return;
    handleCodeScanned(pendingCode, actionType, reason);
  }

  // Toggle front / back camera
  function toggleFacingMode() {
    setSelectedDeviceId("");
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
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
          maxHeight: "94vh",
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
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, rgba(200,164,92,0.12) 0%, transparent 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.5rem" }}>📸</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.125rem", color: "#ffffff", fontWeight: 700 }}>
                Escaneo Inteligente de Asistencia
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Entradas, Permisos Temporales y Salidas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ color: "var(--color-text-muted)" }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflowY: "auto",
          }}
        >
          {cameraError && (
            <div
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: 16,
                background: "rgba(184, 59, 46, 0.15)",
                border: "1px solid var(--color-error)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-error)",
                fontSize: "0.875rem",
                textAlign: "center",
              }}
            >
              ⚠️ {cameraError}
            </div>
          )}

          {/* Video Preview Box with QR targeting overlay */}
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1 / 1",
              maxWidth: 320,
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
              border: "2px solid var(--color-primary-border)",
              background: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            {/* Targeting reticle frame */}
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
              {isScanning && !lastResult && (
                <div
                  style={{
                    width: "72%",
                    height: "72%",
                    border: "2px dashed rgba(200,164,92,0.85)",
                    borderRadius: "16px",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                    position: "relative",
                  }}
                >
                  {/* Top-left bracket */}
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      left: -2,
                      width: 20,
                      height: 20,
                      borderTop: "4px solid var(--color-primary)",
                      borderLeft: "4px solid var(--color-primary)",
                      borderTopLeftRadius: 16,
                    }}
                  />
                  {/* Top-right bracket */}
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderTop: "4px solid var(--color-primary)",
                      borderRight: "4px solid var(--color-primary)",
                      borderTopRightRadius: 16,
                    }}
                  />
                  {/* Bottom-left bracket */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: -2,
                      width: 20,
                      height: 20,
                      borderBottom: "4px solid var(--color-primary)",
                      borderLeft: "4px solid var(--color-primary)",
                      borderBottomLeftRadius: 16,
                    }}
                  />
                  {/* Bottom-right bracket */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderBottom: "4px solid var(--color-primary)",
                      borderRight: "4px solid var(--color-primary)",
                      borderBottomRightRadius: 16,
                    }}
                  />

                  {/* Scanning radar line animation */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: "2px",
                      background: "linear-gradient(90deg, transparent, #c8a45c, #ffffff, #c8a45c, transparent)",
                      boxShadow: "0 0 8px #c8a45c",
                      animation: "scanLine 2.2s infinite ease-in-out",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes scanLine {
              0% {
                top: 5%;
                opacity: 0.2;
              }
              50% {
                top: 92%;
                opacity: 1;
              }
              100% {
                top: 5%;
                opacity: 0.2;
              }
            }
          `}</style>

          {/* Camera Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              marginTop: 12,
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {availableCameras.length > 1 ? (
              <select
                className="select"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{ fontSize: "0.8125rem", padding: "6px 8px", flex: "1 1 180px" }}
              >
                <option value="">Lente Automático (1x)</option>
                {availableCameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Cámara ${idx + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-dim)" }}>
                Cámara: {facingMode === "environment" ? "Trasera (1x)" : "Frontal"}
              </span>
            )}

            <button
              type="button"
              onClick={toggleFacingMode}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 8px", display: "inline-flex", gap: 4, alignItems: "center" }}
            >
              🔄 Alternar Frontal/Trasera
            </button>
          </div>

          {/* Processing Indicator */}
          {processing && (
            <div style={{ marginTop: 14, textAlign: "center", color: "var(--color-primary)" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                ⏳ Procesando marcación de empleado...
              </span>
            </div>
          )}

          {/* CASO B: DIALOGO CONTEXTUAL (Salida Temporal vs Salida Definitiva) */}
          {lastResult &&
            (lastResult.action === "requires_scan_action" ||
              lastResult.action === "requires_checkout_confirmation") && (
              <div
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "18px 16px",
                  borderRadius: "var(--radius-md)",
                  animation: "fadeIn 0.2s ease-out",
                  background: "linear-gradient(180deg, rgba(200,164,92,0.18) 0%, rgba(20,16,10,0.96) 100%)",
                  border: "2px solid var(--color-primary)",
                  textAlign: "center",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                }}
              >
                {!isEnteringTempLeaveReason ? (
                  <>
                    <span style={{ fontSize: "2rem", display: "block", marginBottom: 6 }}>📋⏳</span>

                    {lastResult.employee && (
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1.1875rem", color: "#ffffff", fontWeight: 800 }}>
                        {lastResult.employee.first_name} {lastResult.employee.last_name}
                      </h4>
                    )}

                    <p style={{ margin: "0 0 14px 0", fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                      Entrada activa hoy a las <strong style={{ color: "var(--color-primary)" }}>{lastResult.check_in_time}</strong>.
                      <br />
                      ¿Qué acción deseas registrar?
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setIsEnteringTempLeaveReason(true)}
                        disabled={processing}
                        className="btn btn-secondary btn-sm"
                        style={{
                          width: "100%",
                          padding: "10px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          borderColor: "#f59e0b",
                          color: "#f59e0b",
                        }}
                      >
                        ⏸️ Salida Temporal / Emergencia
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecuteScanAction("final_checkout")}
                        disabled={processing}
                        className="btn btn-primary btn-sm"
                        style={{
                          width: "100%",
                          padding: "10px",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        🚪 Salida Definitiva
                      </button>

                      <button
                        type="button"
                        onClick={handleResumeScan}
                        disabled={processing}
                        className="btn btn-ghost btn-sm"
                        style={{ width: "100%", padding: "6px", color: "var(--color-text-dim)" }}
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "1.75rem", display: "block", marginBottom: 4 }}>⏸️ Motivo de Permiso</span>
                    <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", margin: "0 0 10px 0" }}>
                      Indica el motivo de la salida temporal de <strong>{lastResult.employee?.first_name}</strong>:
                    </p>

                    {/* Quick suggestion tags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, justifyContent: "center" }}>
                      {["Emergencia familiar", "Cita médica", "Trámite bancario / urgente", "Almuerzo / Refrigerio"].map(
                        (quick) => (
                          <button
                            key={quick}
                            type="button"
                            onClick={() => setTempLeaveReasonInput(quick)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              fontSize: "0.6875rem",
                              padding: "3px 8px",
                              background: "rgba(200,164,92,0.1)",
                              border: "1px solid rgba(200,164,92,0.25)",
                              borderRadius: "12px",
                            }}
                          >
                            {quick}
                          </button>
                        )
                      )}
                    </div>

                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Escribe el motivo del permiso (Obligatorio)..."
                      value={tempLeaveReasonInput}
                      onChange={(e) => setTempLeaveReasonInput(e.target.value)}
                      style={{
                        width: "100%",
                        fontSize: "0.85rem",
                        padding: "8px 10px",
                        marginBottom: 12,
                        borderRadius: "var(--radius-sm)",
                      }}
                      autoFocus
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setIsEnteringTempLeaveReason(false)}
                        disabled={processing}
                        className="btn btn-secondary btn-sm"
                        style={{ width: "100%", padding: "8px" }}
                      >
                        ◀ Volver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempLeaveReasonInput.trim()) {
                            alert("Por favor escribe el motivo del permiso.");
                            return;
                          }
                          handleExecuteScanAction("temp_leave", tempLeaveReasonInput.trim());
                        }}
                        disabled={processing || !tempLeaveReasonInput.trim()}
                        className="btn btn-primary btn-sm"
                        style={{ width: "100%", padding: "8px", fontWeight: 700 }}
                      >
                        ✓ Registrar Permiso
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          {/* CASO A, C, B.1, B.2 o ERROR: RESULTADO DE LA MARCACION */}
          {lastResult &&
            lastResult.action !== "requires_scan_action" &&
            lastResult.action !== "requires_checkout_confirmation" && (
              <div
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  animation: "fadeIn 0.2s ease-out",
                  background:
                    lastResult.action === "check_in" || lastResult.action === "temp_leave_return"
                      ? "rgba(106, 153, 78, 0.15)"
                      : lastResult.action === "temp_leave_start"
                      ? "rgba(245, 158, 11, 0.15)"
                      : lastResult.action === "check_out"
                      ? "rgba(200, 164, 92, 0.15)"
                      : lastResult.action === "already_completed"
                      ? "rgba(212, 163, 76, 0.15)"
                      : "rgba(184, 59, 46, 0.15)",
                  border: `1px solid ${
                    lastResult.action === "check_in" || lastResult.action === "temp_leave_return"
                      ? "rgba(106, 153, 78, 0.4)"
                      : lastResult.action === "temp_leave_start"
                      ? "rgba(245, 158, 11, 0.4)"
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
                    : lastResult.action === "temp_leave_start"
                    ? "⏸️"
                    : lastResult.action === "temp_leave_return"
                    ? "🟢"
                    : lastResult.action === "check_out"
                    ? "🚪"
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
                      lastResult.action === "check_in" || lastResult.action === "temp_leave_return"
                        ? "var(--color-success)"
                        : lastResult.action === "temp_leave_start"
                        ? "#f59e0b"
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

                {lastResult.check_in_time && lastResult.check_out_time && (
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                    Entrada: {lastResult.check_in_time} | Salida: {lastResult.check_out_time}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleResumeScan}
                  className="btn btn-primary btn-sm"
                  style={{
                    marginTop: 14,
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
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
