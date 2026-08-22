"use client";

import { useState, useEffect } from "react";
import {
  PERMISSION_TYPE_LABELS,
  type PermissionType,
  type ConflictingBooking,
  type PermissionStatus,
} from "@/lib/types/permissions";

interface EmployeeAbsenceRangeModalProps {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function EmployeeAbsenceRangeModal({
  employee,
  onClose,
  onSuccess,
}: EmployeeAbsenceRangeModalProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [permissionType, setPermissionType] = useState<PermissionType>("personal");
  const [reason, setReason] = useState("");
  const [observation, setObservation] = useState("");
  const [status, setStatus] = useState<PermissionStatus>("approved");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictingBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subir archivo de evidencia
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

  // Verificar conflictos de reservas en vivo
  useEffect(() => {
    let isCancelled = false;

    async function checkConflicts() {
      if (!startDate || !endDate || endDate < startDate) {
        setConflicts([]);
        return;
      }

      setCheckingConflicts(true);
      try {
        const res = await fetch("/api/admin/employees/absences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employee.id,
            start_date: startDate,
            end_date: endDate,
            is_all_day: isAllDay,
            start_time: isAllDay ? undefined : startTime,
            end_time: isAllDay ? undefined : endTime,
            check_conflicts_only: true,
          }),
        });

        if (!isCancelled && res.ok) {
          const data = await res.json();
          setConflicts(data.conflicts || []);
        }
      } catch (err) {
        console.error("Error checking conflicts:", err);
      } finally {
        if (!isCancelled) setCheckingConflicts(false);
      }
    }

    const timer = setTimeout(checkConflicts, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [employee.id, startDate, endDate, isAllDay, startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (endDate < startDate) {
      setError("La fecha final no puede ser anterior a la inicial.");
      return;
    }

    if (!isAllDay && startDate === endDate && startTime >= endTime) {
      setError("La hora final debe ser posterior a la hora inicial.");
      return;
    }

    if (!reason.trim()) {
      setError("Ingresa un motivo para el permiso.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/employees/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          start_date: startDate,
          end_date: endDate,
          is_all_day: isAllDay,
          start_time: isAllDay ? null : startTime,
          end_time: isAllDay ? null : endTime,
          permission_type: permissionType,
          reason: reason.trim(),
          observation: observation.trim() || null,
          evidence_url: evidenceUrl.trim() || null,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar el permiso.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Error de conexión al registrar el permiso.");
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
      aria-label="Registrar Permiso por Rango"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 580,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              📅 Registrar Permiso / Bloqueo por Rango
            </h3>
            <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              Trabajador: <strong>{employee.first_name} {employee.last_name}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Tipo de Permiso */}
          <div>
            <label className="label">Tipo de Permiso</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(Object.keys(PERMISSION_TYPE_LABELS) as PermissionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPermissionType(t)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: permissionType === t ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: permissionType === t ? "rgba(200, 164, 92, 0.12)" : "var(--color-bg-input)",
                    color: permissionType === t ? "var(--color-primary)" : "var(--color-text)",
                    fontWeight: permissionType === t ? 700 : 500,
                    fontSize: "0.76rem",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {PERMISSION_TYPE_LABELS[t].icon} {PERMISSION_TYPE_LABELS[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Rango de Fechas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="label" htmlFor="perm-start-date">
                Fecha Inicial
              </label>
              <input
                id="perm-start-date"
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
            </div>
            <div>
              <label className="label" htmlFor="perm-end-date">
                Fecha Final
              </label>
              <input
                id="perm-end-date"
                type="date"
                className="input"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                style={{ width: "100%", fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* Toggle Todo el Día vs Por Horas */}
          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "rgba(200,164,92,0.04)", border: "1px solid var(--color-border)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                style={{ accentColor: "var(--color-primary)", width: 16, height: 16 }}
              />
              <span>Bloquear todo el día</span>
            </label>

            {!isAllDay && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>
                    Hora Inicial:
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ width: "100%", padding: "4px 8px", fontSize: "0.82rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>
                    Hora Final:
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{ width: "100%", padding: "4px 8px", fontSize: "0.82rem" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="label" htmlFor="perm-reason">
              Motivo Principal
            </label>
            <input
              id="perm-reason"
              type="text"
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Vacaciones aprobadas, consulta médica Essalud..."
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* Observaciones */}
          <div>
            <label className="label" htmlFor="perm-obs">
              Observaciones (Opcional)
            </label>
            <textarea
              id="perm-obs"
              className="input"
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Detalles adicionales para la administración..."
              style={{ width: "100%", resize: "vertical", fontSize: "0.82rem" }}
            />
          </div>

          {/* Evidencia adjunta */}
          <div>
            <label className="label">Evidencia o Comprobante (Opcional)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="file"
                accept="image/*,application/pdf"
                id="absence-evidence-file"
                style={{ display: "none" }}
                onChange={(e) => handleEvidenceUpload(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => document.getElementById("absence-evidence-file")?.click()}
                className="btn btn-secondary btn-sm"
                disabled={uploadingEvidence}
                style={{ fontSize: "0.78rem" }}
              >
                {uploadingEvidence ? "Subiendo..." : "📎 Adjuntar archivo/foto"}
              </button>
              {evidenceUrl && (
                <span style={{ fontSize: "0.75rem", color: "var(--color-success)" }}>
                  ✅ Evidencia cargada
                </span>
              )}
            </div>
          </div>

          {/* Panel de Advertencia de Reservas en Conflicto */}
          {checkingConflicts ? (
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: 0 }}>
              Verificando reservas existentes en ese rango...
            </p>
          ) : conflicts.length > 0 ? (
            <div
              style={{
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontWeight: 700, fontSize: "0.82rem" }}>
                <span>⚠️ Advertencia: {conflicts.length} cita(s) asignada(s) en este horario</span>
              </div>
              <p style={{ fontSize: "0.74rem", color: "var(--color-text-muted)", margin: 0 }}>
                El permiso no cancelará automáticamente estas reservas, pero bloqueará nuevas citas. Deberás reasignarlas desde el panel de reservas:
              </p>
              <div style={{ maxHeight: 110, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {conflicts.map((c) => (
                  <div key={c.id} style={{ fontSize: "0.72rem", padding: "4px 8px", background: "var(--color-bg-card)", borderRadius: "var(--radius-sm)" }}>
                    <strong>{c.booking_date} {c.start_time} - {c.end_time}</strong> · {c.client_name} ({c.booking_code})
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading ? "Guardando..." : "Registrar Permiso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
