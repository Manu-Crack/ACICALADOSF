"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CALENDAR_EVENT_CONFIG,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarViewMode,
} from "@/lib/types/calendar";
import { CalendarEventModal } from "./CalendarEventModal";
import { EmployeeAbsenceRangeModal } from "@/app/dashboard/empleados/EmployeeAbsenceRangeModal";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  type: string;
  is_active: boolean;
}

interface CalendarManagerProps {
  userRole?: string;
}

export function CalendarManager({ userRole = "admin" }: CalendarManagerProps) {
  const isAdmin = userRole === "admin";
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [activeTypes, setActiveTypes] = useState<Record<CalendarEventType, boolean>>({
    booking: true,
    permission: true,
    attendance: true,
    bonus: true,
  });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Calcular fechas de inicio y fin según el modo de visualización
  const { startDate, endDate } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === "day") {
      const dStr = currentDate.toISOString().slice(0, 10);
      return { startDate: dStr, endDate: dStr };
    }

    if (viewMode === "week") {
      const cur = new Date(currentDate);
      const day = cur.getDay();
      const diffToMonday = cur.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(cur.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: monday.toISOString().slice(0, 10),
        endDate: sunday.toISOString().slice(0, 10),
      };
    }

    // Month view
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    // Extender para cubrir la cuadrícula completa de 35 o 42 días
    const startPadding = (firstDay.getDay() + 6) % 7; // Lunes=0
    const startGrid = new Date(firstDay);
    startGrid.setDate(firstDay.getDate() - startPadding);

    const endPadding = (7 - ((lastDay.getDay() + 6) % 7) - 1) % 7;
    const endGrid = new Date(lastDay);
    endGrid.setDate(lastDay.getDate() + endPadding);

    return {
      startDate: startGrid.toISOString().slice(0, 10),
      endDate: endGrid.toISOString().slice(0, 10),
    };
  }, [currentDate, viewMode]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const typesList = (Object.keys(activeTypes) as CalendarEventType[]).filter((t) => activeTypes[t]);
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        types: typesList.join(","),
      });

      if (selectedEmployeeId !== "all") {
        params.set("employee_id", selectedEmployeeId);
      }

      const res = await fetch(`/api/admin/calendar/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        if (data.employees) setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Error loading calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedEmployeeId, activeTypes]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Navegación
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Título dinámico
  const titleLabel = useMemo(() => {
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const y = currentDate.getFullYear();
    const m = monthNames[currentDate.getMonth()];

    if (viewMode === "day") {
      return `${currentDate.getDate()} de ${m} de ${y}`;
    }
    if (viewMode === "week") {
      return `Semana: ${startDate} al ${endDate}`;
    }
    return `${m} ${y}`;
  }, [currentDate, viewMode, startDate, endDate]);

  // Agrupar eventos por fecha
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      // Si el evento tiene rango de fechas (ej: permiso multidia)
      if (ev.end_date && ev.end_date !== ev.date) {
        const cur = new Date(ev.date + "T12:00:00Z");
        const end = new Date(ev.end_date + "T12:00:00Z");
        while (cur <= end) {
          const dStr = cur.toISOString().slice(0, 10);
          if (!map.has(dStr)) map.set(dStr, []);
          map.get(dStr)!.push(ev);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        if (!map.has(ev.date)) map.set(ev.date, []);
        map.get(ev.date)!.push(ev);
      }
    });
    return map;
  }, [events]);

  // Generar días para vista de mes
  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }> = [];
    const cur = new Date(startDate + "T12:00:00Z");
    const end = new Date(endDate + "T12:00:00Z");
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetMonth = currentDate.getMonth();

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      days.push({
        dateStr: dStr,
        dayNum: cur.getUTCDate(),
        isCurrentMonth: cur.getUTCMonth() === targetMonth,
        isToday: dStr === todayStr,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [viewMode, startDate, endDate, currentDate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "8px 0" }}>
      {/* Header Controls */}
      <div
        className="card card-gold"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "18px 22px",
        }}
      >
        {/* Left: Title & Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={handlePrev} className="btn btn-secondary btn-sm" title="Anterior">
              ◀
            </button>
            <button type="button" onClick={handleToday} className="btn btn-ghost btn-sm" style={{ fontWeight: 700 }}>
              Hoy
            </button>
            <button type="button" onClick={handleNext} className="btn btn-secondary btn-sm" title="Siguiente">
              ▶
            </button>
          </div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
            {titleLabel}
          </h2>
        </div>

        {/* Center: View Mode Toggle */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.3)", padding: 4, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
          {(["day", "week", "month"] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: viewMode === mode ? "var(--color-primary)" : "transparent",
                color: viewMode === mode ? "#111" : "var(--color-text)",
                fontWeight: viewMode === mode ? 800 : 500,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {mode === "day" ? "Día" : mode === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        {/* Right: Employee Filter & Action */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="select"
            style={{ fontSize: "0.84rem", padding: "6px 12px", minWidth: 180 }}
          >
            <option value="all">👥 Todos los Especialistas</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.type === "spa" ? "Spa" : "Barbería"})
              </option>
            ))}
          </select>

        </div>
      </div>

      {/* Filter Badges Bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 600 }}>Mostrar:</span>
        {(Object.keys(CALENDAR_EVENT_CONFIG) as CalendarEventType[]).map((t) => {
          const cfg = CALENDAR_EVENT_CONFIG[t];
          const isActive = activeTypes[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTypes({ ...activeTypes, [t]: !isActive })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${isActive ? cfg.color : "var(--color-border)"}`,
                background: isActive ? cfg.bgColor : "transparent",
                color: isActive ? cfg.color : "var(--color-text-dim)",
                fontSize: "0.76rem",
                fontWeight: isActive ? 700 : 400,
                cursor: "pointer",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <span>{cfg.icon}</span> {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Calendar Grid Body */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: "center" }}>
          <p className="text-muted">Cargando eventos del cronograma...</p>
        </div>
      ) : viewMode === "month" ? (
        /* VISTA DE MES */
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Header días de la semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "center", fontSize: "0.78rem", fontWeight: 700, color: "var(--color-primary)", padding: "10px 0" }}>
            <div>LUNES</div>
            <div>MARTES</div>
            <div>MIÉRCOLES</div>
            <div>JUEVES</div>
            <div>VIERNES</div>
            <div>SÁBADO</div>
            <div>DOMINGO</div>
          </div>

          {/* Cuadrícula de Días */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "minmax(110px, auto)" }}>
            {monthDays.map((d, idx) => {
              const dayEvents = eventsByDate.get(d.dateStr) || [];
              return (
                <div
                  key={idx}
                  style={{
                    borderRight: (idx + 1) % 7 !== 0 ? "1px solid rgba(200, 164, 92, 0.06)" : "none",
                    borderBottom: "1px solid rgba(200, 164, 92, 0.06)",
                    background: d.isToday
                      ? "rgba(200, 164, 92, 0.06)"
                      : d.isCurrentMonth
                      ? "transparent"
                      : "rgba(0, 0, 0, 0.2)",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    minHeight: 110,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: d.isToday ? 800 : d.isCurrentMonth ? 600 : 400,
                        color: d.isToday
                          ? "var(--color-primary)"
                          : d.isCurrentMonth
                          ? "var(--color-text)"
                          : "var(--color-text-dim)",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: d.isToday ? "rgba(200, 164, 92, 0.2)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {d.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span style={{ fontSize: "0.65rem", color: "var(--color-text-dim)" }}>
                        {dayEvents.length} ev.
                      </span>
                    )}
                  </div>

                  {/* Lista de Eventos del Día */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, overflowY: "auto", maxHeight: 90 }}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        style={{
                          textAlign: "left",
                          padding: "2px 5px",
                          borderRadius: 3,
                          background: ev.bg_color,
                          borderLeft: `3px solid ${ev.color}`,
                          borderTop: "none",
                          borderRight: "none",
                          borderBottom: "none",
                          color: ev.color,
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "block",
                          width: "100%",
                        }}
                        title={`${ev.employee_name}: ${ev.title}`}
                      >
                        {ev.icon} {ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ""}{ev.employee_name.split(" ")[0]} · {ev.title.slice(0, 16)}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: "0.65rem", color: "var(--color-primary)", textAlign: "center" }}>
                        +{dayEvents.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === "week" ? (
        /* VISTA DE SEMANA */
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {Array.from({ length: 7 }).map((_, idx) => {
              const d = new Date(startDate + "T12:00:00Z");
              d.setDate(d.getDate() + idx);
              const dStr = d.toISOString().slice(0, 10);
              const dayEvents = eventsByDate.get(dStr) || [];
              const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(200, 164, 92, 0.03)",
                    border: "1px solid var(--color-border)",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 280,
                  }}
                >
                  <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 6, textAlign: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 700, display: "block" }}>
                      {dayNames[idx]}
                    </span>
                    <strong style={{ fontSize: "0.95rem" }}>{d.getUTCDate()}</strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                    {dayEvents.length === 0 ? (
                      <span style={{ fontSize: "0.72rem", color: "var(--color-text-dim)", textAlign: "center", marginTop: 20 }}>
                        Sin eventos
                      </span>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            background: ev.bg_color,
                            borderLeft: `3px solid ${ev.color}`,
                            fontSize: "0.74rem",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", color: ev.color, fontWeight: 700, fontSize: "0.7rem" }}>
                            <span>{ev.icon} {ev.start_time || "Todo el día"}</span>
                          </div>
                          <p style={{ margin: "2px 0", fontWeight: 600, color: "var(--color-text)" }}>{ev.employee_name}</p>
                          <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--color-text-muted)" }}>{ev.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA DE DÍA */
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {events.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <p className="text-muted">No hay eventos programados para este día.</p>
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md)",
                    background: ev.bg_color,
                    border: `1px solid ${ev.border_color}`,
                    cursor: "pointer",
                    transition: "transform 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: "1.5rem" }}>{ev.icon}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: "0.95rem", color: "var(--color-text)" }}>
                          {ev.employee_name}
                        </strong>
                        <span className={`badge ${ev.badge_class}`} style={{ fontSize: "0.65rem" }}>
                          {ev.status_label}
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
                        {ev.title} {ev.description ? `· ${ev.description}` : ""}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: ev.color, fontWeight: 700, fontSize: "0.88rem" }}>
                      {ev.start_time ? `${ev.start_time}${ev.end_time ? ` - ${ev.end_time}` : ""}` : "Todo el día"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalle de Evento */}
      {selectedEvent && (
        <CalendarEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Modal de Nuevo Permiso (si se abre desde el calendario) */}
      {showPermissionModal && employees.length > 0 && (
        <EmployeeAbsenceRangeModal
          employee={
            selectedEmployeeId !== "all"
              ? employees.find((e) => e.id === selectedEmployeeId) || employees[0]
              : employees[0]
          }
          onClose={() => setShowPermissionModal(false)}
          onSuccess={() => {
            setShowPermissionModal(false);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}
