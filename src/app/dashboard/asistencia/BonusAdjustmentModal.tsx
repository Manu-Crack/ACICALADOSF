"use client";

import { useState } from "react";

interface BonusAdjustmentModalProps {
  attendanceId: string;
  employeeName: string;
  dateStr: string;
  currentBonusMinutes: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function BonusAdjustmentModal({
  attendanceId,
  employeeName,
  dateStr,
  currentBonusMinutes,
  onClose,
  onSuccess,
}: BonusAdjustmentModalProps) {
  const [bonusMinutes, setBonusMinutes] = useState(currentBonusMinutes);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (bonusMinutes < 0) {
      setError("Los minutos de bonificación no pueden ser negativos.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Debes ingresar un motivo de ajuste válido (mínimo 5 caracteres).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/attendance/bonus-adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendance_id: attendanceId,
          bonus_minutes: Number(bonusMinutes),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo actualizar la bonificación.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Error de conexión al enviar el ajuste.");
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
      aria-label="Ajuste Manual de Bonificación"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "24px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              ⏱️ Ajustar Tiempo de Bonificación
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
          <div>
            <label className="label" htmlFor="bonus-minutes-input">
              Minutos de Bonificación
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="bonus-minutes-input"
                type="number"
                min="0"
                step="1"
                className="input"
                value={bonusMinutes}
                onChange={(e) => setBonusMinutes(Math.max(0, parseInt(e.target.value || "0", 10)))}
                required
                style={{ width: 120, fontSize: "1.1rem", fontWeight: 700, color: "var(--color-primary)" }}
              />
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                = {(bonusMinutes / 60).toFixed(2)} horas bonificadas
              </span>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="adjustment-reason">
              Motivo del Ajuste Manual (Auditoría)
            </label>
            <textarea
              id="adjustment-reason"
              className="input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Corrección por turno extendido aprobado en local..."
              required
              style={{ width: "100%", resize: "vertical", fontSize: "0.82rem" }}
            />
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
              {loading ? "Guardando..." : "Guardar Ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
