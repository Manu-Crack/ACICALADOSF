"use client";

import { useState, useEffect, useCallback } from "react";
import {
  JUSTIFICATION_TYPE_LABELS,
  JUSTIFICATION_STATUS_LABELS,
  JUSTIFICATION_STATUS_BADGE,
  type AttendanceJustification,
  type JustificationStatus,
} from "@/lib/types/bonus";

interface JustificationHistoryModalProps {
  employeeId?: string;
  attendanceId?: string;
  employeeName?: string;
  userRole?: string;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export function JustificationHistoryModal({
  employeeId,
  attendanceId,
  employeeName,
  userRole = "admin",
  onClose,
  onStatusChanged,
}: JustificationHistoryModalProps) {
  const isAdmin = userRole === "admin";
  const [justifications, setJustifications] = useState<AttendanceJustification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const fetchJustifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (employeeId) params.set("employee_id", employeeId);
      if (attendanceId) params.set("attendance_id", attendanceId);

      const res = await fetch(`/api/admin/attendance/justifications?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudieron cargar las justificaciones.");
        return;
      }

      setJustifications(data.justifications || []);
    } catch {
      setError("Error de conexión al cargar justificaciones.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, attendanceId]);

  useEffect(() => {
    fetchJustifications();
  }, [fetchJustifications]);

  const handleUpdateStatus = async (id: string, newStatus: JustificationStatus) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/attendance/justifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          review_notes: reviewNotes[id]?.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "No se pudo actualizar el estado de la justificación.");
        return;
      }

      onStatusChanged?.();
      fetchJustifications();
    } catch {
      alert("Error de conexión.");
    } finally {
      setActionLoadingId(null);
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
      aria-label="Historial de Justificaciones"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              📜 Historial de Justificaciones
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              {employeeName ? `Personal: ${employeeName}` : "Historial de justificaciones del personal"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p className="text-muted">Cargando justificaciones...</p>
          </div>
        ) : error ? (
          <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
            ❌ {error}
          </div>
        ) : justifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
            <p className="text-muted">No hay justificaciones registradas para esta selección.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {justifications.map((j) => {
              const isActionLoading = actionLoadingId === j.id;

              return (
                <div
                  key={j.id}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(200, 164, 92, 0.04)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text)" }}>
                        {JUSTIFICATION_TYPE_LABELS[j.type]}
                      </span>
                      <span className={`badge ${JUSTIFICATION_STATUS_BADGE[j.status]}`} style={{ fontSize: "0.68rem" }}>
                        {JUSTIFICATION_STATUS_LABELS[j.status]}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
                      {new Date(j.created_at).toLocaleDateString("es-PE")} {new Date(j.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div>
                    <p style={{ fontSize: "0.84rem", margin: "0 0 4px", fontWeight: 600, color: "var(--color-text)" }}>
                      Motivo: <span style={{ fontWeight: 400 }}>{j.reason}</span>
                    </p>
                    {j.observation && (
                      <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: "0 0 4px" }}>
                        Detalle: {j.observation}
                      </p>
                    )}
                  </div>

                  {/* Evidencia */}
                  {j.evidence_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem" }}>
                      <span>📎 Evidencia:</span>
                      <a
                        href={j.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ padding: "2px 8px", fontSize: "0.72rem", color: "var(--color-primary)" }}
                      >
                        🔍 Ver documento adjunto
                      </a>
                    </div>
                  )}

                  {/* Historial de Auditoría */}
                  {Array.isArray(j.audit_history) && j.audit_history.length > 0 && (
                    <div style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-bg-card)", border: "1px solid var(--color-border)", fontSize: "0.72rem" }}>
                      <p style={{ fontWeight: 700, margin: "0 0 4px", color: "var(--color-text-muted)" }}>Historial de cambios:</p>
                      {j.audit_history.map((a, idx) => (
                        <div key={idx} style={{ color: "var(--color-text-muted)", marginBottom: 2 }}>
                          • {a.timestamp?.slice(0, 16).replace("T", " ")} — {a.user_name || "Admin"}: {a.details}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Acciones de Administrador para Aprobar/Rechazar */}
                  {isAdmin && j.status === "pending" && (
                    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Nota de revisión / motivo de decisión..."
                        value={reviewNotes[j.id] || ""}
                        onChange={(e) => setReviewNotes({ ...reviewNotes, [j.id]: e.target.value })}
                        style={{ fontSize: "0.78rem", padding: "4px 8px" }}
                      />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(j.id, "rejected")}
                          disabled={isActionLoading}
                          className="btn btn-sm"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontSize: "0.75rem" }}
                        >
                          ✕ Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(j.id, "approved")}
                          disabled={isActionLoading}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: "0.75rem" }}
                        >
                          ✓ Aprobar Justificación
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
