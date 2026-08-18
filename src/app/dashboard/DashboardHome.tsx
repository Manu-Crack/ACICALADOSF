"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type TodayBooking = {
  id: string;
  booking_code: string;
  client_first_name: string;
  client_last_name: string;
  start_time: string;
  status: string;
  payment_status: string;
  service_type: string;
  booking_date: string;
};

interface DashboardHomeProps {
  initialBookings: TodayBooking[];
  initialWeekCount: number;
}

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente (WhatsApp)",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
};

const statusColors: Record<string, string> = {
  pendiente: "badge-warning",
  confirmada: "badge-success",
  completada: "badge-gold",
  cancelada: "badge-error",
};

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DashboardHome({
  initialBookings,
  initialWeekCount,
}: DashboardHomeProps) {
  const [bookings, setBookings] = useState<TodayBooking[]>(initialBookings);
  const [weekCount, setWeekCount] = useState<number>(initialWeekCount);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Función para recargar datos de hoy y semana de forma silenciosa
  const loadData = useCallback(async () => {
    try {
      const todayStr = getLocalDateString();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = getLocalDateString(weekStart);

      const [todayRes, weekRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date"
          )
          .eq("booking_date", todayStr)
          .in("status", ["confirmada", "completada", "pendiente"])
          .order("start_time"),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("booking_date", weekStartStr)
          .in("status", ["confirmada", "completada"]),
      ]);

      if (todayRes.data) {
        setBookings(todayRes.data);
      }
      if (typeof weekRes.count === "number") {
        setWeekCount(weekRes.count);
      }
    } catch (err) {
      console.error("[DashboardHome] Error recargando datos del día:", err);
    }
  }, [supabase]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Suscripción protegida y autenticada a Supabase Realtime para reservas de hoy
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        console.log("[Supabase Realtime: DashboardHome] 🔄 Verificando sesión de administrador...");
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          console.log("[Supabase Realtime: DashboardHome] 🔑 Aplicando JWT de administrador...");
          supabase.realtime.setAuth(session.access_token);
        }

        if (!isMounted) return;

        const channelName = "realtime-dashboard-home-today";
        const existing = supabase.getChannels().find(
          (c: { topic: string }) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }

        console.log("[Supabase Realtime: DashboardHome] 📡 Inicializando canal:", channelName);

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
              console.log("[Supabase Realtime: DashboardHome] ⚡ INSERT recibido:", payload.new);
              const newBooking = payload.new as unknown as TodayBooking;
              const todayStr = getLocalDateString();

              // Solo agregar si la reserva corresponde a la fecha de hoy
              if (
                newBooking.booking_date === todayStr &&
                ["confirmada", "completada", "pendiente"].includes(newBooking.status)
              ) {
                setBookings((prev) => {
                  if (prev.some((b) => b.id === newBooking.id || b.booking_code === newBooking.booking_code)) {
                    return prev;
                  }
                  const next = [newBooking, ...prev];
                  return next.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                });
              }

              // Sincronizar estadísticas y lista en segundo plano
              if (loadDataRef.current) {
                loadDataRef.current();
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
              console.log("[Supabase Realtime: DashboardHome] ⚡ UPDATE recibido:", payload.new);
              const updatedBooking = payload.new as unknown as TodayBooking;
              const todayStr = getLocalDateString();

              setBookings((prev) => {
                const isToday = updatedBooking.booking_date === todayStr;
                const isValidStatus = ["confirmada", "completada", "pendiente"].includes(updatedBooking.status);

                if (!isToday || !isValidStatus) {
                  return prev.filter((b) => b.id !== updatedBooking.id);
                }

                const exists = prev.some((b) => b.id === updatedBooking.id);
                if (exists) {
                  return prev
                    .map((b) => (b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b))
                    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                } else {
                  return [updatedBooking, ...prev].sort((a, b) =>
                    (a.start_time || "").localeCompare(b.start_time || "")
                  );
                }
              });

              if (loadDataRef.current) {
                loadDataRef.current();
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
              console.log("[Supabase Realtime: DashboardHome] ⚡ DELETE recibido:", payload.old);
              const deletedId = (payload.old as { id?: string })?.id;
              if (deletedId) {
                setBookings((prev) => prev.filter((b) => b.id !== deletedId));
              }

              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .subscribe((status: string, err?: Error | unknown) => {
            console.log(`[Supabase Realtime: DashboardHome] 📡 Estado: ${status}`);
            if (status === "SUBSCRIBED") {
              console.log("[Supabase Realtime: DashboardHome] 🟢 Conexión activa escuchando reservas de hoy.");
              setIsRealtimeConnected(true);
            } else if (status === "CHANNEL_ERROR") {
              console.error("[Supabase Realtime: DashboardHome] ❌ Error en el canal Realtime:", err);
              setIsRealtimeConnected(false);
            } else if (status === "TIMED_OUT") {
              console.warn("[Supabase Realtime: DashboardHome] ⏱️ Timeout en canal Realtime.");
              setIsRealtimeConnected(false);
            } else if (status === "CLOSED") {
              console.log("[Supabase Realtime: DashboardHome] 🔒 Canal Realtime cerrado.");
              setIsRealtimeConnected(false);
            }
          });
      } catch (err) {
        console.error("[Supabase Realtime: DashboardHome] Error inicializando suscripción:", err);
      }
    }

    initRealtime();

    const { data: authSubData } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { access_token?: string } | null) => {
        if (session?.access_token) {
          console.log("[Supabase Realtime: DashboardHome] 🔄 Token renovado, sincronizando Realtime...");
          supabase.realtime.setAuth(session.access_token);
        }
      }
    );

    return () => {
      isMounted = false;
      authSubData?.subscription?.unsubscribe();
      if (channel) {
        console.log("[Supabase Realtime: DashboardHome] 🛑 Desmontando componente: Removiendo canal...");
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Cálculos dinámicos de estadísticas en tiempo real
  const todayCount = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmada").length;
  const completedCount = bookings.filter((b) => b.status === "completada").length;

  const stats: { label: string; value: number; icon: React.ReactNode; color: string }[] = [
    {
      label: "Citas Hoy",
      value: todayCount,
      icon: <img src="/calendario.svg" alt="Citas Hoy" style={{ width: 22, height: 22 }} />,
      color: "var(--color-primary)",
    },
    {
      label: "Confirmadas",
      value: confirmedCount,
      icon: <img src="/Activo.svg" alt="Confirmadas" style={{ width: 22, height: 22 }} />,
      color: "var(--color-success)",
    },
    {
      label: "Completadas",
      value: completedCount,
      icon: "🏁",
      color: "var(--color-info)",
    },
    {
      label: "Esta Semana",
      value: weekCount,
      icon: "📊",
      color: "var(--color-warning)",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="heading-lg">Dashboard</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {new Date().toLocaleDateString("es-PE", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Indicador en vivo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(200, 164, 92, 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isRealtimeConnected ? "var(--color-success)" : "#f59e0b",
                display: "inline-block",
                boxShadow: isRealtimeConnected ? "0 0 8px var(--color-success)" : "0 0 8px #f59e0b",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: isRealtimeConnected ? "var(--color-success)" : "var(--color-text-muted)",
              }}
            >
              {isRealtimeConnected ? "🟢 En vivo (Realtime)" : "🟡 Conectando..."}
            </span>
          </div>

          <Link href="/dashboard/reservas" className="btn btn-primary btn-sm">
            📋 Gestionar Reservas WhatsApp →
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-4" style={{ marginBottom: 40 }}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 16 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--radius-md)",
                background: `${stat.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              {stat.icon}
            </div>
            <div>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: stat.color,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </p>
              <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Agenda */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <h2 className="heading-md" style={{ marginBottom: 0 }}>
            📋 Agenda del Día
          </h2>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--color-primary)",
            }}
          >
            {bookings.length} {bookings.length === 1 ? "cita hoy" : "citas hoy"}
          </span>
        </div>

        {bookings && bookings.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Hora</th>
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Cliente</th>
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Código</th>
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Tipo</th>
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Estado</th>
                  <th style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Pago</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      transition: "background var(--transition-fast)",
                    }}
                  >
                    <td style={{ padding: "12px", fontWeight: 600, fontSize: "0.9375rem" }}>
                      {b.start_time?.slice(0, 5)}
                    </td>
                    <td style={{ padding: "12px", fontSize: "0.9375rem" }}>
                      {b.client_first_name} {b.client_last_name}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <code style={{ color: "var(--color-primary)", fontSize: "0.8125rem" }}>
                        {b.booking_code}
                      </code>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        className="badge badge-gold"
                        style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <img
                          src={b.service_type === "barberia" ? "/LogoBarberia.svg" : "/LogoSpa.svg"}
                          alt={b.service_type === "barberia" ? "Barbería" : "Spa"}
                          style={{ height: 12, width: "auto" }}
                        />
                        {b.service_type === "barberia" ? "Barbería" : "Spa"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span className={`badge ${statusColors[b.status] || "badge-neutral"}`}>
                        {statusLabels[b.status] || b.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        className={`badge ${
                          b.payment_status === "total"
                            ? "badge-success"
                            : b.payment_status === "parcial"
                            ? "badge-warning"
                            : "badge-error"
                        }`}
                      >
                        {b.payment_status === "total"
                          ? "Pagado"
                          : b.payment_status === "parcial"
                          ? "Parcial"
                          : "Sin pago"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted" style={{ textAlign: "center", padding: 32 }}>
            No hay citas programadas para hoy.
          </p>
        )}
      </div>
    </div>
  );
}
