"use client";

import {
  CALENDAR_EVENT_CONFIG,
  type CalendarEvent,
} from "@/lib/types/calendar";

interface CalendarEventModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function CalendarEventModal({ event, onClose }: CalendarEventModalProps) {
  const cfg = CALENDAR_EVENT_CONFIG[event.type];

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
      aria-label="Detalle del Evento del Calendario"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px",
          background: "var(--color-bg-card)",
          border: `1px solid ${event.border_color || "var(--color-border)"}`,
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.6rem" }}>{event.icon}</span>
            <div>
              <span className={`badge ${event.badge_class}`} style={{ fontSize: "0.68rem" }}>
                {event.status_label || cfg.label}
              </span>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "4px 0 0 0", color: "var(--color-text)" }}>
                {event.title}
              </h3>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: "0.85rem" }}>
          {/* Trabajador asignado */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(200, 164, 92, 0.05)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Especialista:</span>
            <strong style={{ color: "var(--color-primary)" }}>{event.employee_name}</strong>
          </div>

          {/* Fecha y Horario */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(200, 164, 92, 0.05)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Fecha / Horario:</span>
            <span>
              {event.date}
              {event.end_date && event.end_date !== event.date ? ` al ${event.end_date}` : ""}
              {event.start_time && ` (${event.start_time}${event.end_time ? ` - ${event.end_time}` : ""})`}
            </span>
          </div>

          {/* Detalles específicos según tipo de evento */}
          {event.type === "booking" && (
            <>
              {event.details.client_name && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Cliente:</span>
                  <strong>{event.details.client_name}</strong>
                </div>
              )}
              {event.details.client_phone && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Teléfono:</span>
                  <span>{event.details.client_phone}</span>
                </div>
              )}
              {event.details.booking_code && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Código Reserva:</span>
                  <code style={{ color: "var(--color-primary)" }}>{event.details.booking_code}</code>
                </div>
              )}
              {event.details.services && (
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>Servicios:</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {event.details.services.map((s, idx) => (
                      <span key={idx} className="badge badge-gold" style={{ fontSize: "0.72rem" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {event.details.price_cents !== undefined && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Monto Total:</span>
                  <strong>S/ {(event.details.price_cents / 100).toFixed(2)}</strong>
                </div>
              )}
            </>
          )}

          {event.type === "permission" && (
            <>
              {event.details.permission_type && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Categoría:</span>
                  <strong>{event.details.permission_type}</strong>
                </div>
              )}
              {event.details.reason && (
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>Motivo:</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>{event.details.reason}</p>
                </div>
              )}
              {event.details.observation && (
                <div>
                  <span style={{ color: "var(--color-text-muted)", display: "block", marginBottom: 2 }}>Observaciones:</span>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted)" }}>{event.details.observation}</p>
                </div>
              )}
              {event.details.evidence_url && (
                <div style={{ marginTop: 4 }}>
                  <a
                    href={event.details.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.76rem" }}
                  >
                    📎 Ver Comprobante / Evidencia
                  </a>
                </div>
              )}
            </>
          )}

          {event.type === "attendance" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Entrada:</span>
                <strong>{event.start_time || "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Salida:</span>
                <strong>{event.end_time || "—"}</strong>
              </div>
            </>
          )}

          {event.type === "bonus" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Minutos Bonificados:</span>
                <strong style={{ color: "#22c55e", fontSize: "1.1rem" }}>+{event.details.bonus_minutes} min</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Horas Bonificadas:</span>
                <span>{event.details.bonus_hours} hrs</span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
          <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
