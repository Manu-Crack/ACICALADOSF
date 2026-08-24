"use client";

import { useMemo, useState } from "react";
import {
  CALENDAR_EVENT_CONFIG,
  type CalendarEvent,
} from "@/lib/types/calendar";
import { exportDailyCalendarAgendaPdf } from "@/lib/utils/daily-calendar-agenda-pdf";

interface CalendarDayEventsModalProps {
  dateStr: string;
  events: CalendarEvent[];
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

export function CalendarDayEventsModal({
  dateStr,
  events,
  onClose,
  onSelectEvent,
}: CalendarDayEventsModalProps) {
  const [exportingPdf, setExportingPdf] = useState(false);

  // Formatear fecha para el encabezado en español
  const formattedDate = useMemo(() => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return d.toLocaleDateString("es-PE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }, [dateStr]);

  // Ordenar eventos por hora de inicio
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const timeA = a.start_time || "00:00";
      const timeB = b.start_time || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [events]);

  // Manejar exportación a PDF de la agenda del día
  const handleExportPdf = () => {
    try {
      setExportingPdf(true);
      exportDailyCalendarAgendaPdf(dateStr, events);
    } catch (err) {
      console.error("Error al exportar agenda en PDF:", err);
    } finally {
      setTimeout(() => setExportingPdf(false), 1000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
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
      aria-label={`Eventos del ${formattedDate}`}
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          background: "var(--color-bg-card, #12100C)",
          border: "1px solid rgba(200, 164, 92, 0.4)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.8)",
          borderRadius: "var(--radius-lg, 12px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(200, 164, 92, 0.05)",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.3rem" }}>📅</span>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--color-text)",
                  margin: 0,
                  textTransform: "capitalize",
                }}
              >
                {formattedDate}
              </h3>
            </div>
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.78rem",
                color: "var(--color-text-muted)",
              }}
            >
              Total de eventos programados:{" "}
              <strong style={{ color: "var(--color-primary)" }}>{events.length}</strong>
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Botón de exportación en el Header */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: "0.78rem",
                padding: "6px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 700,
              }}
              title="Descargar agenda del día en formato PDF"
              id="export-day-agenda-header-btn"
            >
              {exportingPdf ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12 }} />
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <span>📄 Exportar Agenda del Día</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{
                padding: "4px 8px",
                fontSize: "1.1rem",
                lineHeight: 1,
                color: "var(--color-text-muted)",
              }}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* List of Events */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            maxHeight: "calc(88vh - 140px)",
          }}
        >
          {sortedEvents.length === 0 ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--color-text-muted)" }}>
              No hay eventos para este día.
            </div>
          ) : (
            sortedEvents.map((ev) => {
              const cfg = CALENDAR_EVENT_CONFIG[ev.type];
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md, 8px)",
                    background: ev.bg_color || "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${ev.border_color || "var(--color-border)"}`,
                    borderLeft: `4px solid ${ev.color || "var(--color-primary)"}`,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateX(3px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectEvent(ev);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: "1.3rem", lineHeight: 1, marginTop: 2 }}>{ev.icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong
                          style={{
                            fontSize: "0.88rem",
                            color: "var(--color-text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {ev.employee_name}
                        </strong>
                        <span
                          className={`badge ${ev.badge_class || "badge-neutral"}`}
                          style={{ fontSize: "0.65rem", padding: "1px 6px" }}
                        >
                          {ev.status_label || cfg?.label || ev.type}
                        </span>
                        {ev.employee_specialty && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "var(--color-text-muted)",
                              background: "rgba(255, 255, 255, 0.05)",
                              padding: "1px 5px",
                              borderRadius: 3,
                            }}
                          >
                            {ev.employee_specialty}
                          </span>
                        )}
                      </div>

                      <p
                        style={{
                          margin: "3px 0 0 0",
                          fontSize: "0.8rem",
                          color: "var(--color-text-muted)",
                          lineHeight: 1.3,
                        }}
                      >
                        {ev.title}
                        {ev.description ? ` · ${ev.description}` : ""}
                      </p>

                      {ev.details?.services && Array.isArray(ev.details.services) && ev.details.services.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                          {ev.details.services.map((srv, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                fontSize: "0.65rem",
                                background: "rgba(200, 164, 92, 0.1)",
                                color: "var(--color-primary)",
                                padding: "1px 5px",
                                borderRadius: 3,
                              }}
                            >
                              {srv}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span
                      style={{
                        color: ev.color || "var(--color-primary)",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      {ev.start_time
                        ? `${ev.start_time.slice(0, 5)}${ev.end_time ? ` - ${ev.end_time.slice(0, 5)}` : ""}`
                        : "Todo el día"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--color-primary)",
                        opacity: 0.85,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      Ver detalle ➔
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(200, 164, 92, 0.02)",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {/* Botón de exportación en el Footer */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="btn btn-secondary btn-sm"
            style={{
              padding: "6px 14px",
              fontSize: "0.8rem",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--color-primary)",
              borderColor: "rgba(200, 164, 92, 0.4)",
            }}
            id="export-day-agenda-footer-btn"
          >
            {exportingPdf ? "Generando PDF..." : "📄 Exportar Agenda del Día"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: "6px 18px", fontSize: "0.82rem" }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
