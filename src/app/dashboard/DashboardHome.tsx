"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Egreso, formatCentsToSoles, getCategoryInfo } from "@/lib/types/expense";

export type FinancialBooking = {
  id: string;
  booking_code: string;
  client_first_name: string;
  client_last_name: string;
  start_time: string;
  status: string;
  payment_status: string;
  service_type: string;
  booking_date: string;
  total_price_cents?: number;
  advance_amount_cents?: number;
  balance_cents?: number;
  created_at?: string;
};

export type TodayBooking = FinancialBooking;

interface DashboardHomeProps {
  initialBookings: FinancialBooking[];
  initialWeekCount: number;
  initialFinancialBookings?: FinancialBooking[];
  initialFinancialEgresos?: Egreso[];
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

/**
 * REGLA ESTRICTA:
 * Solo se suman ingresos de reservas en estado confirmado o completado.
 * Se ignora por completo cualquier registro en estado 'pendiente', 'cancelada' o 'expirada'.
 */
function calculateValidIncomeForBooking(b: FinancialBooking): number {
  if (
    b.status === "pendiente" ||
    b.status === "cancelada" ||
    b.status === "expirada" ||
    b.status === "borrador"
  ) {
    return 0;
  }

  if (b.status === "confirmada" || b.status === "completada") {
    if (b.payment_status === "total") {
      return b.total_price_cents || 0;
    }
    if (b.payment_status === "parcial") {
      return (
        b.advance_amount_cents ||
        (b.total_price_cents ? Math.round(b.total_price_cents * 0.3) : 0)
      );
    }
    if (b.status === "completada") {
      return b.total_price_cents || 0;
    }
    if (b.advance_amount_cents && b.advance_amount_cents > 0) {
      return b.advance_amount_cents;
    }
    return b.total_price_cents || 0;
  }

  if (b.payment_status === "total") {
    return b.total_price_cents || 0;
  }
  if (b.payment_status === "parcial") {
    return b.advance_amount_cents || 0;
  }

  return 0;
}

export function DashboardHome({
  initialBookings,
  initialWeekCount,
  initialFinancialBookings = [],
  initialFinancialEgresos = [],
}: DashboardHomeProps) {
  // Agenda & Operational stats state
  const [bookings, setBookings] = useState<FinancialBooking[]>(initialBookings);
  const [weekCount, setWeekCount] = useState<number>(initialWeekCount);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Financial Panel state
  const [financialRange, setFinancialRange] = useState<"day" | "week" | "month">("day");
  const [financialBookings, setFinancialBookings] = useState<FinancialBooking[]>(initialFinancialBookings);
  const [financialEgresos, setFinancialEgresos] = useState<Egreso[]>(initialFinancialEgresos);
  const [financialTab, setFinancialTab] = useState<"todos" | "ingresos" | "egresos">("todos");

  const supabase = useMemo(() => createClient(), []);

  // Compute date strings for current range
  const dateBounds = useMemo(() => {
    const now = new Date();
    const todayStr = getLocalDateString(now);

    // Week start (Monday) and end (Sunday)
    const cur = new Date();
    const dayOfWeek = cur.getDay();
    const diffToMonday = cur.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(cur.setDate(diffToMonday));
    const mondayStr = getLocalDateString(monday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = getLocalDateString(sunday);

    // Month start and end
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const monthStartStr = `${year}-${month}-01`;
    const monthEndStr = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    return {
      todayStr,
      mondayStr,
      sundayStr,
      monthStartStr,
      monthEndStr,
    };
  }, []);

  // Recargar datos de la agenda y de finanzas
  const loadData = useCallback(async () => {
    try {
      const { todayStr, mondayStr, monthStartStr } = dateBounds;

      const [todayRes, weekRes, monthBookingsRes, monthExpensesRes, monthEgresosRes] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
          )
          .eq("booking_date", todayStr)
          .in("status", ["confirmada", "completada", "pendiente"])
          .order("start_time"),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .gte("booking_date", mondayStr)
          .in("status", ["confirmada", "completada"]),
        supabase
          .from("bookings")
          .select(
            "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
          )
          .gte("booking_date", monthStartStr)
          .order("booking_date", { ascending: false }),
        supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", monthStartStr)
          .order("expense_date", { ascending: false }),
        supabase
          .from("egresos")
          .select("*")
          .gte("expense_date", monthStartStr)
          .order("expense_date", { ascending: false }),
      ]);

      if (todayRes.data) {
        setBookings(todayRes.data as unknown as FinancialBooking[]);
      }
      if (typeof weekRes.count === "number") {
        setWeekCount(weekRes.count);
      }
      if (monthBookingsRes.data) {
        setFinancialBookings(monthBookingsRes.data as unknown as FinancialBooking[]);
      }

      const rawExpenses = (monthExpensesRes.data || []).filter((e: { status?: string }) => e.status !== "voided").map((e: { id: string; description: string; category: string; amount_cents: number; expense_date: string; payment_method: string; receipt_url?: string; supplier?: string; notes?: string; created_at: string }) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount_cents: e.amount_cents,
        currency: "PEN",
        expense_date: e.expense_date,
        payment_method: e.payment_method,
        receipt_type: e.receipt_url ? "comprobante" : "ninguno",
        receipt_number: null,
        supplier: e.supplier || null,
        notes: e.notes || null,
        created_at: e.created_at,
        updated_at: e.created_at,
      }));

      const rawEgresos = (monthEgresosRes.data || []) as unknown as Egreso[];
      setFinancialEgresos([...rawExpenses, ...rawEgresos]);
    } catch (err) {
      console.error("[DashboardHome] Error recargando datos:", err);
    }
  }, [supabase, dateBounds]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Suscripción protegida y autenticada a Supabase Realtime para reservas y egresos
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }

        if (!isMounted) return;

        const channelName = "realtime-dashboard-home-consolidated";
        const existing = supabase.getChannels().find(
          (c: { topic: string }) =>
            c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "bookings",
            },
            () => {
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "expenses",
            },
            () => {
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "egresos",
            },
            () => {
              if (loadDataRef.current) {
                loadDataRef.current();
              }
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setIsRealtimeConnected(true);
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
              setIsRealtimeConnected(false);
            }
          });
      } catch (err) {
        console.error("[Supabase Realtime: DashboardHome] Error:", err);
      }
    }

    initRealtime();

    const { data: authSubData } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { access_token?: string } | null) => {
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      }
    );

    return () => {
      isMounted = false;
      authSubData?.subscription?.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Cálculos dinámicos de agenda del día
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

  // Cálculos de Finanzas según el filtro seleccionado (Día, Semana, Mes)
  const filteredFinancialData = useMemo(() => {
    const { todayStr, mondayStr, sundayStr, monthStartStr, monthEndStr } = dateBounds;

    // Filtrar reservas por periodo
    const inRangeBookings = financialBookings.filter((b) => {
      if (financialRange === "day") {
        return b.booking_date === todayStr;
      }
      if (financialRange === "week") {
        return b.booking_date >= mondayStr && b.booking_date <= sundayStr;
      }
      if (financialRange === "month") {
        return b.booking_date >= monthStartStr && b.booking_date <= monthEndStr;
      }
      return true;
    });

    // Filtrar egresos por periodo
    const inRangeEgresos = financialEgresos.filter((e) => {
      if (financialRange === "day") {
        return e.expense_date === todayStr;
      }
      if (financialRange === "week") {
        return e.expense_date >= mondayStr && e.expense_date <= sundayStr;
      }
      if (financialRange === "month") {
        return e.expense_date >= monthStartStr && e.expense_date <= monthEndStr;
      }
      return true;
    });

    // APLICACIÓN ESTRICTA: Solo considerar reservas confirmadas/pagadas (descartar pendientes)
    const validConfirmedBookings = inRangeBookings.filter(
      (b) => calculateValidIncomeForBooking(b) > 0
    );

    const totalIncomeCents = validConfirmedBookings.reduce(
      (acc, b) => acc + calculateValidIncomeForBooking(b),
      0
    );

    const totalExpenseCents = inRangeEgresos.reduce(
      (acc, e) => acc + (e.amount_cents || 0),
      0
    );

    const netBalanceCents = totalIncomeCents - totalExpenseCents;

    // Ratio para barra de flujo
    const totalVolume = totalIncomeCents + totalExpenseCents;
    const incomePercent = totalVolume > 0 ? Math.round((totalIncomeCents / totalVolume) * 100) : 50;
    const expensePercent = totalVolume > 0 ? 100 - incomePercent : 50;

    return {
      inRangeBookings,
      validConfirmedBookings,
      inRangeEgresos,
      totalIncomeCents,
      totalExpenseCents,
      netBalanceCents,
      incomePercent,
      expensePercent,
    };
  }, [financialRange, financialBookings, financialEgresos, dateBounds]);

  const periodLabel = useMemo(() => {
    if (financialRange === "day") return "Hoy";
    if (financialRange === "week") return "Esta Semana";
    return "Este Mes";
  }, [financialRange]);

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
              {isRealtimeConnected ? "🟢 En vivo (Realtime)" : "🟡 Conectando..."}
            </span>
          </div>

          <Link href="/dashboard/reservas" className="btn btn-primary btn-sm">
            📋 Gestionar Reservas WhatsApp →
          </Link>
        </div>
      </div>

      {/* Operative Stats Grid */}
      <div className="grid grid-4" style={{ marginBottom: 32 }}>
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

      {/* ========================================================================= */}
      {/* PANEL CONSOLIDADO FINANCIERO (INGRESOS VS EGRESOS)                        */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          marginBottom: 32,
          border: "1px solid rgba(200, 164, 92, 0.35)",
          background: "linear-gradient(180deg, rgba(20, 20, 20, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* Panel Header with Title & Time Filter Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "rgba(200, 164, 92, 0.12)",
                border: "1px solid rgba(200, 164, 92, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              📊
            </div>
            <div>
              <h2 className="heading-md" style={{ margin: 0, fontSize: "1.25rem" }}>
                Consolidado Financiero
              </h2>
              <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                Balance unificado de Ingresos Confirmados y Egresos Operativos ({periodLabel})
              </p>
            </div>
          </div>

          {/* Time Selector Tabs: Día, Semana, Mes */}
          <div
            style={{
              display: "inline-flex",
              background: "#0A0A0A",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "4px",
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setFinancialRange("day")}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: financialRange === "day" ? "var(--color-primary)" : "transparent",
                color: financialRange === "day" ? "#000" : "var(--color-text-muted)",
                transition: "all var(--transition-fast)",
              }}
            >
              📅 Día (Hoy)
            </button>
            <button
              type="button"
              onClick={() => setFinancialRange("week")}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: financialRange === "week" ? "var(--color-primary)" : "transparent",
                color: financialRange === "week" ? "#000" : "var(--color-text-muted)",
                transition: "all var(--transition-fast)",
              }}
            >
              📈 Semana
            </button>
            <button
              type="button"
              onClick={() => setFinancialRange("month")}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: financialRange === "month" ? "var(--color-primary)" : "transparent",
                color: financialRange === "month" ? "#000" : "var(--color-text-muted)",
                transition: "all var(--transition-fast)",
              }}
            >
              🗓️ Mes
            </button>
          </div>
        </div>

        {/* 3 Main Financial Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          {/* Card 1: Ingresos Válidos */}
          <div
            style={{
              background: "rgba(34, 197, 94, 0.04)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#4ade80",
                }}
              >
                💰 Ingresos Válidos
              </span>
              <span
                className="badge badge-success"
                style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                title="Solo reservas confirmadas o pagadas. Registros pendientes ignorados."
              >
                Solo Confirmados
              </span>
            </div>

            <p
              style={{
                fontSize: "1.85rem",
                fontWeight: 800,
                color: "#4ade80",
                marginTop: 10,
                marginBottom: 4,
                lineHeight: 1.1,
              }}
            >
              {formatCentsToSoles(filteredFinancialData.totalIncomeCents)}
            </p>

            <p className="text-muted" style={{ fontSize: "0.775rem", margin: 0 }}>
              {filteredFinancialData.validConfirmedBookings.length}{" "}
              {filteredFinancialData.validConfirmedBookings.length === 1
                ? "reserva confirmada/pagada"
                : "reservas confirmadas/pagadas"}
            </p>
          </div>

          {/* Card 2: Egresos Operativos */}
          <div
            style={{
              background: "rgba(239, 68, 68, 0.04)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#f87171",
                }}
              >
                💸 Egresos Operativos
              </span>
              <Link
                href="/dashboard/egresos"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-primary)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Ver módulo →
              </Link>
            </div>

            <p
              style={{
                fontSize: "1.85rem",
                fontWeight: 800,
                color: "#f87171",
                marginTop: 10,
                marginBottom: 4,
                lineHeight: 1.1,
              }}
            >
              {formatCentsToSoles(filteredFinancialData.totalExpenseCents)}
            </p>

            <p className="text-muted" style={{ fontSize: "0.775rem", margin: 0 }}>
              {filteredFinancialData.inRangeEgresos.length}{" "}
              {filteredFinancialData.inRangeEgresos.length === 1
                ? "gasto registrado"
                : "gastos registrados"}
            </p>
          </div>

          {/* Card 3: Balance Neto (Utilidad) */}
          <div
            style={{
              background:
                filteredFinancialData.netBalanceCents >= 0
                  ? "rgba(200, 164, 92, 0.06)"
                  : "rgba(239, 68, 68, 0.08)",
              border:
                filteredFinancialData.netBalanceCents >= 0
                  ? "1px solid rgba(200, 164, 92, 0.4)"
                  : "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color:
                    filteredFinancialData.netBalanceCents >= 0
                      ? "var(--color-primary)"
                      : "#f87171",
                }}
              >
                📈 Balance Neto (Utilidad)
              </span>
              <span
                className={`badge ${
                  filteredFinancialData.netBalanceCents >= 0 ? "badge-gold" : "badge-error"
                }`}
                style={{ fontSize: "0.7rem", padding: "2px 8px" }}
              >
                {filteredFinancialData.netBalanceCents >= 0 ? "Superávit Positivo" : "Déficit"}
              </span>
            </div>

            <p
              style={{
                fontSize: "1.85rem",
                fontWeight: 800,
                color:
                  filteredFinancialData.netBalanceCents >= 0
                    ? "var(--color-primary)"
                    : "#f87171",
                marginTop: 10,
                marginBottom: 4,
                lineHeight: 1.1,
              }}
            >
              {filteredFinancialData.netBalanceCents >= 0 ? "+" : ""}
              {formatCentsToSoles(filteredFinancialData.netBalanceCents)}
            </p>

            <p className="text-muted" style={{ fontSize: "0.775rem", margin: 0 }}>
              Margen operativo neto del periodo
            </p>
          </div>
        </div>

        {/* Visual Progress Ratio Bar */}
        {(filteredFinancialData.totalIncomeCents > 0 || filteredFinancialData.totalExpenseCents > 0) && (
          <div
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              <span style={{ color: "#4ade80" }}>
                Ingresos: {filteredFinancialData.incomePercent}% ({formatCentsToSoles(filteredFinancialData.totalIncomeCents)})
              </span>
              <span style={{ color: "#f87171" }}>
                Egresos: {filteredFinancialData.expensePercent}% ({formatCentsToSoles(filteredFinancialData.totalExpenseCents)})
              </span>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: "var(--radius-full)",
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                display: "flex",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${filteredFinancialData.incomePercent}%`,
                  backgroundColor: "#22c55e",
                  transition: "width 0.4s ease",
                }}
              />
              <div
                style={{
                  width: `${filteredFinancialData.expensePercent}%`,
                  backgroundColor: "#ef4444",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Detail Movements Tabs & Mini Table */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-text)" }}>
              📋 Movimientos Financieros de {periodLabel}
            </span>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setFinancialTab("todos")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: financialTab === "todos" ? "rgba(200, 164, 92, 0.2)" : "transparent",
                  color: financialTab === "todos" ? "var(--color-primary)" : "var(--color-text-muted)",
                }}
              >
                Todos ({filteredFinancialData.validConfirmedBookings.length + filteredFinancialData.inRangeEgresos.length})
              </button>
              <button
                type="button"
                onClick={() => setFinancialTab("ingresos")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: financialTab === "ingresos" ? "rgba(34, 197, 94, 0.2)" : "transparent",
                  color: financialTab === "ingresos" ? "#4ade80" : "var(--color-text-muted)",
                }}
              >
                Ingresos Válidos ({filteredFinancialData.validConfirmedBookings.length})
              </button>
              <button
                type="button"
                onClick={() => setFinancialTab("egresos")}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: financialTab === "egresos" ? "rgba(239, 68, 68, 0.2)" : "transparent",
                  color: financialTab === "egresos" ? "#f87171" : "var(--color-text-muted)",
                }}
              >
                Egresos ({filteredFinancialData.inRangeEgresos.length})
              </button>
            </div>
          </div>

          {/* Table of Movements */}
          {filteredFinancialData.validConfirmedBookings.length === 0 &&
          filteredFinancialData.inRangeEgresos.length === 0 ? (
            <p className="text-muted" style={{ textAlign: "center", padding: "20px 0", fontSize: "0.85rem" }}>
              No se registran movimientos financieros confirmados para {periodLabel.toLowerCase()}.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>Tipo</th>
                    <th style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>Fecha / Hora</th>
                    <th style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>Concepto / Cliente</th>
                    <th style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>Categoría / Servicio</th>
                    <th style={{ padding: "8px 10px", color: "var(--color-text-muted)", textAlign: "right" }}>
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Ingresos Válidos */}
                  {(financialTab === "todos" || financialTab === "ingresos") &&
                    filteredFinancialData.validConfirmedBookings.map((b) => {
                      const amount = calculateValidIncomeForBooking(b);
                      return (
                        <tr
                          key={`income-${b.id}`}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            backgroundColor: "rgba(34, 197, 94, 0.02)",
                          }}
                        >
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: "rgba(34, 197, 94, 0.15)",
                                color: "#4ade80",
                              }}
                            >
                              + INGRESO
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                            {b.booking_date} {b.start_time?.slice(0, 5)}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontWeight: 600 }}>
                              {b.client_first_name} {b.client_last_name}
                            </span>{" "}
                            <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                              ({b.booking_code})
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span className="badge badge-gold" style={{ fontSize: "0.7rem" }}>
                              {b.service_type === "barberia" ? "Barbería" : b.service_type === "spa" ? "Spa" : "Mixto"}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#4ade80",
                              whiteSpace: "nowrap",
                            }}
                          >
                            + {formatCentsToSoles(amount)}
                          </td>
                        </tr>
                      );
                    })}

                  {/* Egresos */}
                  {(financialTab === "todos" || financialTab === "egresos") &&
                    filteredFinancialData.inRangeEgresos.map((e) => {
                      const catInfo = getCategoryInfo(e.category);
                      return (
                        <tr
                          key={`expense-${e.id}`}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            backgroundColor: "rgba(239, 68, 68, 0.02)",
                          }}
                        >
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                              }}
                            >
                              - EGRESO
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                            {e.expense_date}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontWeight: 600 }}>{e.description}</span>
                            {e.supplier && (
                              <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                                {" "}• {e.supplier}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: "0.7rem",
                                color: catInfo.color,
                              }}
                            >
                              {catInfo.icon} {catInfo.label}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#f87171",
                              whiteSpace: "nowrap",
                            }}
                          >
                            - {formatCentsToSoles(e.amount_cents)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AGENDA DEL DÍA (MANTENIDA AL 100%)                                       */}
      {/* ========================================================================= */}
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
                        {b.service_type === "barberia" ? "Barbería" : b.service_type === "spa" ? "Spa" : "Mixto"}
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
