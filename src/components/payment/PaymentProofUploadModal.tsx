"use client";

import { useState, useRef, useCallback } from "react";

interface PaymentProofUploadModalProps {
  bookingId: string;
  bookingCode: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentProofUploadModal({
  bookingId,
  bookingCode,
  onClose,
  onSuccess,
}: PaymentProofUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File | null) => {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Solo se admiten imágenes en formato JPG, PNG o WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo supera el tamaño máximo permitido de 5 MB.");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Por favor selecciona una imagen del comprobante.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("booking_id", bookingId);
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      const res = await fetch("/api/bookings/proof", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo subir el comprobante.");
        return;
      }

      setSuccessMsg(data.message || "Comprobante subido exitosamente.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch {
      setError("Error de conexión al enviar el comprobante.");
    } finally {
      setLoading(false);
    }
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
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(5px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Subir comprobante para reserva ${bookingCode}`}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "24px",
          position: "relative",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
              📸 Subir Comprobante de Pago
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              Reserva: <strong className="text-gold">{bookingCode}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: "4px 8px", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* File Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              background: "rgba(200, 164, 92, 0.03)",
              transition: "border-color 0.2s ease",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            {previewUrl ? (
              <div>
                <img
                  src={previewUrl}
                  alt="Vista previa del comprobante"
                  style={{
                    maxHeight: 180,
                    maxWidth: "100%",
                    objectFit: "contain",
                    borderRadius: "var(--radius-sm)",
                    margin: "0 auto 8px",
                    display: "block",
                  }}
                />
                <p style={{ fontSize: "0.78rem", color: "var(--color-primary)", fontWeight: 600, margin: 0 }}>
                  Cambiar imagen ({selectedFile?.name})
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>📄</div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
                  Haz clic o arrastra tu comprobante aquí
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 4 }}>
                  JPG, PNG o WebP (Máx. 5 MB)
                </p>
              </div>
            )}
          </div>

          {/* Notes field */}
          <div>
            <label className="label" htmlFor="proof-notes" style={{ fontSize: "0.78rem" }}>
              Notas / Número de Operación (opcional)
            </label>
            <input
              id="proof-notes"
              type="text"
              className="input"
              placeholder="Ej: Operación #12345678"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", fontSize: "0.85rem" }}
            />
          </div>

          {/* Alert: Upload doesn't auto-confirm */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              fontSize: "0.76rem",
              color: "var(--color-text-muted)",
              lineHeight: 1.4,
            }}
          >
            ⚠️ <strong>Importante:</strong> La subida del comprobante no confirma de inmediato la cita. Nuestro personal verificará la transferencia en el sistema para confirmar tu horario.
          </div>

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
              ❌ {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(106, 153, 78, 0.15)", color: "var(--color-success)", fontSize: "0.8rem", fontWeight: 600 }}>
              ✅ {successMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || loading || !!successMsg}
              style={{ flex: 2 }}
            >
              {loading ? "Subiendo..." : "Enviar Comprobante"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
