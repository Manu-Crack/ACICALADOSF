"use client";

import { useState } from "react";
import {
  JUSTIFICATION_TYPE_LABELS,
  type JustificationType,
} from "@/lib/types/bonus";

interface JustificationModalProps {
  attendanceId?: string | null;
  employeeId: string;
  employeeName: string;
  initialType?: JustificationType;
  dateStr: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function JustificationModal({
  attendanceId,
  employeeId,
  employeeName,
  initialType = "check_in",
  dateStr,
  onClose,
  onSuccess,
}: JustificationModalProps) {
  const [type, setType] = useState<JustificationType>(initialType);
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subida opcional de evidencia a Supabase Storage
  const handleEvidenceUpload = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo supera el límite de 5 MB.");
      return;
    }

    setUploadingEvidence(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Usamos el endpoint de upload general para evidencias
      const res = await fetch("/api/admin/services/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo subir la evidencia.");
        return;
      }

      setEvidenceUrl(data.url);
    } catch {
      setError("Error al subir el archivo de evidencia.");
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Ingresa un motivo claro (mínimo 3 caracteres).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/attendance/justifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance_id: attendanceId || undefined,
          employee_id: employeeId,
          type,
          reason: reason.trim(),
          observation: observation.trim() || undefined,
          evidence_url: evidenceUrl.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar la justificación.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Error de conexión al enviar la justificación.");
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
      aria-label="Registrar Justificación de Asistencia"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              📝 Registrar Justificación
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              {employeeName} · Fecha: {dateStr}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Tipo de Justificación */}
          <div>
            <label className="label">Tipo de Justificación</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["check_in", "check_out"] as JustificationType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: type === t ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: type === t ? "rgba(200, 164, 92, 0.12)" : "var(--color-bg-input)",
                    color: type === t ? "var(--color-primary)" : "var(--color-text)",
                    fontWeight: type === t ? 700 : 500,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {JUSTIFICATION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="label" htmlFor="just-reason">
              Motivo Principal
            </label>
            <input
              id="just-reason"
              type="text"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cita médica de emergencia, retraso por transporte..."
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* Observación / Detalle */}
          <div>
            <label className="label" htmlFor="just-obs">
              Detalle u Observaciones (Opcional)
            </label>
            <textarea
              id="just-obs"
              className="input"
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Información adicional para la revisión del administrador..."
              style={{ width: "100%", resize: "vertical", fontSize: "0.82rem" }}
            />
          </div>

          {/* Evidencia adjunta */}
          <div>
            <label className="label">Evidencia o Documento (Opcional)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="file"
                accept="image/*,application/pdf"
                id="evidence-file"
                style={{ display: "none" }}
                onChange={(e) => handleEvidenceUpload(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => document.getElementById("evidence-file")?.click()}
                className="btn btn-secondary btn-sm"
                disabled={uploadingEvidence}
                style={{ fontSize: "0.78rem" }}
              >
                {uploadingEvidence ? "Subiendo..." : "📎 Adjuntar comprobante/foto"}
              </button>
              {evidenceUrl && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-success)" }}>
                  ✅ Evidencia cargada
                </span>
              )}
            </div>
          </div>

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading ? "Guardando..." : "Registrar Justificación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
