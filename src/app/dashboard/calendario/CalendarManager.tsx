"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CALENDAR_EVENT_CONFIG,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarViewMode,
} from "@/lib/types/calendar";
import { CalendarEventModal } from "./CalendarEventModal";
import { CalendarDayEventsModal } from "./CalendarDayEventsModal";
import { EmployeeAbsenceRangeModal } from "@/app/dashboard/empleados/EmployeeAbsenceRangeModal";
import { exportDailyCalendarAgendaPdf } from "@/lib/utils/daily-calendar-agenda-pdf";

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

// Helper seguro para formatear fechas a YYYY-MM-DD en la zona horaria local
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [dayEventsModal, setDayEventsModal] = useState<{ dateStr: string; events: CalendarEvent[] } | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Calcular fechas de inicio y fin según el modo de visualización sin desfases horarios
  const { startDate, endDate } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    if (viewMode === "day") {
      const dStr = toDateStr(currentDate);
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
        startDate: toDateStr(monday),
        endDate: toDateStr(sunday),
      };
    }

    // Month view
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    // Extender para cubrir la cuadrícula completa de 35 o 42 días (Lunes=0)
    const startPadding = (firstDay.getDay() + 6) % 7;
    const startGrid = new Date(y, m, 1 - startPadding);

    const lastDayOfWeek = (lastDay.getDay() + 6) % 7;
    const endPadding = 6 - lastDayOfWeek;
    const endGrid = new Date(y, m + 1, endPadding);

    return {
      startDate: toDateStr(startGrid),
      endDate: toDateStr(endGrid),
    };
  }, [currentDate, viewMode]);

  const loadEvents = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
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
        if (!isSilent) setLoading(false);
      }
    },
    [startDate, endDate, selectedEmployeeId, activeTypes]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Referencias para que la suscripción en tiempo real no dependa de re-renders de UI
  const loadEventsRef = useRef(loadEvents);
  useEffect(() => {
    loadEventsRef.current = loadEvents;
  }, [loadEvents]);

  // Suscripción protegida y autenticada a Supabase Realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        console.log("[Supabase Realtime: Calendar] 🔄 Verificando sesión...");
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          console.log("[Supabase Realtime: Calendar] 🔑 Autenticando canal con JWT...");
          supabase.realtime.setAuth(session.access_token);
        }

        if (!isMounted) return;

        const channelName = "realtime-calendar-events-changes";
        const existing = supabase.getChannels().find((c: { topic: string }) => c.topic === `realtime:${channelName}` || c.topic === channelName);
        if (existing) {
          console.log("[Supabase Realtime: Calendar] 🧹 Removiendo canal previo...");
          supabase.removeChannel(existing);
        }

        console.log("[Supabase Realtime: Calendar] 📡 Inicializando canal:", channelName);

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "bookings",
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              console.log("[Supabase Realtime: Calendar] ⚡ INSERT en bookings:", payload.new);
              const newStatus = (payload.new as { status?: string })?.status;
              if (newStatus === "expirada") return;
              if (loadEventsRef.current) {
                loadEventsRef.current(true);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "bookings",
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              console.log("[Supabase Realtime: Calendar] ⚡ UPDATE en bookings:", payload.new);
              const updated = payload.new as {
                id?: string;
                status?: string;
                booking_date?: string;
                start_time?: string;
                end_time?: string;
              };

              if (updated?.id) {
                if (updated.status === "expirada") {
                  setEvents((prev) => prev.filter((ev) => ev.id !== `booking-${updated.id}`));
                  return;
                }

                const statusBadges: Record<string, string> = {
                  confirmada: "badge-success",
                  pendiente: "badge-warning",
                  completada: "badge-gold",
                  cancelada: "badge-error",
                  expirada: "badge-neutral",
                };

                setEvents((prev) =>
                  prev.map((ev) => {
                    if (ev.id === `booking-${updated.id}`) {
                      const newStatus = updated.status || ev.status;
                      return {
                        ...ev,
                        date: updated.booking_date || ev.date,
                        start_time: updated.start_time !== undefined ? updated.start_time : ev.start_time,
                        end_time: updated.end_time !== undefined ? updated.end_time : ev.end_time,
                        status: newStatus,
                        status_label: newStatus.toUpperCase(),
                        badge_class: statusBadges[newStatus] || ev.badge_class,
                      };
                    }
                    return ev;
                  })
                );
              }

              if (loadEventsRef.current) {
                loadEventsRef.current(true);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "bookings",
            },
            (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
              console.log("[Supabase Realtime: Calendar] ⚡ DELETE en bookings:", payload.old);
              const deletedId = (payload.old as { id?: string })?.id;
              if (deletedId) {
                setEvents((prev) => prev.filter((ev) => ev.id !== `booking-${deletedId}`));
              }
              if (loadEventsRef.current) {
                loadEventsRef.current(true);
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "employee_blocks",
            },
            () => {
              console.log("[Supabase Realtime: Calendar] ⚡ Cambio en employee_blocks");
              if (loadEventsRef.current) loadEventsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "employee_attendances",
            },
            () => {
              console.log("[Supabase Realtime: Calendar] ⚡ Cambio en employee_attendances");
              if (loadEventsRef.current) loadEventsRef.current(true);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "employees",
            },
            () => {
              console.log("[Supabase Realtime: Calendar] ⚡ Cambio en employees");
              if (loadEventsRef.current) loadEventsRef.current(true);
            }
          )
          .subscribe((status: string, err?: Error | unknown) => {
            console.log(`[Supabase Realtime: Calendar] 📡 Estado: ${status}`);
            if (status === "SUBSCRIBED") {
              setIsRealtimeConnected(true);
            } else if (status === "CHANNEL_ERROR") {
              console.error("[Supabase Realtime: Calendar] ❌ Error en canal:", err);
              setIsRealtimeConnected(false);
            } else if (status === "TIMED_OUT" || status === "CLOSED") {
              setIsRealtimeConnected(false);
            }
          });
      } catch (err) {
        console.error("[Supabase Realtime: Calendar] Error inicializando suscripción:", err);
      }
    }

    initRealtime();

    const { data: authSubData } = supabase.auth.onAuthStateChange(async (_event: string, session: { access_token?: string } | null) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      isMounted = false;
      authSubData?.subscription?.unsubscribe();
      if (channel) {
        console.log("[Supabase Realtime: Calendar] 🛑 Desmontando: Removiendo canal...");
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Navegación segura
  const handlePrev = () => {
    if (viewMode === "day") {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 1);
        return d;
      });
    } else if (viewMode === "week") {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 1);
        return d;
      });
    } else if (viewMode === "week") {
      setCurrentDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
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
        const [y1, m1, d1] = ev.date.split("-").map(Number);
        const [y2, m2, d2] = ev.end_date.split("-").map(Number);
        const cur = new Date(y1, m1 - 1, d1);
        const end = new Date(y2, m2 - 1, d2);
        while (cur <= end) {
          const dStr = toDateStr(cur);
          if (dStr >= startDate && dStr <= endDate) {
            if (!map.has(dStr)) map.set(dStr, []);
            map.get(dStr)!.push(ev);
          }
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        if (ev.date >= startDate && ev.date <= endDate) {
          if (!map.has(ev.date)) map.set(ev.date, []);
          map.get(ev.date)!.push(ev);
        }
      }
    });
    return map;
  }, [events, startDate, endDate]);

  // Generar días para vista de mes
  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }> = [];
    const [startY, startM, startD] = startDate.split("-").map(Number);
    const [endY, endM, endD] = endDate.split("-").map(Number);
    const cur = new Date(startY, startM - 1, startD);
    const end = new Date(endY, endM - 1, endD);
    const todayStr = toDateStr(new Date());
    const targetMonth = currentDate.getMonth();

    while (cur <= end) {
      const dStr = toDateStr(cur);
      days.push({
        dateStr: dStr,
        dayNum: cur.getDate(),
        isCurrentMonth: cur.getMonth() === targetMonth,
        isToday: dStr === todayStr,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [viewMode, startDate, endDate, currentDate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "8px 0" }}>
      {/* Realtime Connection Indicator Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          background: "rgba(200, 164, 92, 0.04)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "8px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: isRealtimeConnected ? "var(--color-success)" : "#f59e0b",
              display: "inline-block",
              boxShadow: isRealtimeConnected
                ? "0 0 8px var(--color-success)"
                : "0 0 8px #f59e0b",
            }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: isRealtimeConnected ? "var(--color-success)" : "var(--color-text-muted)",
            }}
          >
            {isRealtimeConnected
              ? "🟢 Sincronización en tiempo real activa (Supabase Realtime)"
              : "🟡 Conectando tiempo real..."}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => loadEvents(false)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
            title="Forzar actualización manual de eventos"
            id="refresh-calendar-btn"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: dayEvents.length > 0 ? "pointer" : "default",
                      padding: "2px 0",
                    }}
                    onClick={() => {
                      if (dayEvents.length > 0) {
                        setDayEventsModal({ dateStr: d.dateStr, events: dayEvents });
                      }
                    }}
                    title={dayEvents.length > 0 ? `Ver los ${dayEvents.length} eventos del día` : undefined}
                  >
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
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--color-primary)",
                          fontWeight: 700,
                          background: "rgba(200, 164, 92, 0.12)",
                          padding: "1px 5px",
                          borderRadius: 10,
                        }}
                      >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
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
                        title={`👤 Especialista: ${ev.employee_name}${ev.employee_specialty ? ` (${ev.employee_specialty})` : ""} | ⏰ ${ev.start_time ? ev.start_time.slice(0, 5) : "Todo el día"} | ${ev.title}`}
                      >
                        {ev.icon} {ev.start_time ? `${ev.start_time.slice(0, 5)} ` : ""}{ev.employee_name === "Sin Asignar" ? "⚠️ Sin Asignar" : `👤 ${ev.employee_name.split(" ")[0]}`} · {ev.title.slice(0, 18)}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDayEventsModal({
                            dateStr: d.dateStr,
                            events: dayEvents,
                          });
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--color-primary)",
                          textAlign: "center",
                          padding: "3px 6px",
                          marginTop: 2,
                          fontWeight: 700,
                          width: "100%",
                          borderRadius: 4,
                          background: "rgba(200, 164, 92, 0.1)",
                          border: "1px solid rgba(200, 164, 92, 0.25)",
                          cursor: "pointer",
                          lineHeight: 1.2,
                        }}
                        title={`Ver todos los ${dayEvents.length} eventos de este día`}
                      >
                        +{dayEvents.length - 3} más
                      </button>
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
              const [startY, startM, startD] = startDate.split("-").map(Number);
              const d = new Date(startY, startM - 1, startD + idx);
              const dStr = toDateStr(d);
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
                    <strong style={{ fontSize: "0.95rem" }}>{d.getDate()}</strong>
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
                          <p style={{ margin: "2px 0", fontWeight: 600, color: "var(--color-text)", fontSize: "0.76rem" }}>
                            👤 {ev.employee_name}
                          </p>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--color-primary)", fontWeight: 800 }}>
                Agenda de Citas del Día
              </h4>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.76rem", color: "var(--color-text-muted)" }}>
                Total de eventos: <strong style={{ color: "#fff" }}>{events.length}</strong>
              </p>
            </div>
            {events.length > 0 && (
              <button
                type="button"
                onClick={() => exportDailyCalendarAgendaPdf(toDateStr(currentDate), events)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.78rem",
                  color: "var(--color-primary)",
                  borderColor: "rgba(200, 164, 92, 0.4)",
                  fontWeight: 700,
                }}
                id="export-calendar-day-view-pdf"
              >
                📄 Exportar Agenda del Día (PDF)
              </button>
            )}
          </div>

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
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.95rem", color: "var(--color-text)" }}>
                          👤 {ev.employee_name}
                        </strong>
                        {ev.employee_specialty && (
                          <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 3 }}>
                            {ev.employee_specialty}
                          </span>
                        )}
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

      {/* Modal de Todos los Eventos del Día (In-place) */}
      {dayEventsModal && (
        <CalendarDayEventsModal
          dateStr={dayEventsModal.dateStr}
          events={dayEventsModal.events}
          onClose={() => setDayEventsModal(null)}
          onSelectEvent={(ev) => setSelectedEvent(ev)}
        />
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
