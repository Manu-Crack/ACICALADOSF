"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils/format";
import { PaymentModal } from "./PaymentModal";
import { PaymentSettingsModal } from "./PaymentSettingsModal";
import { NewBookingModal } from "./NewBookingModal";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  type PaymentMethod,
} from "@/lib/types/payments";

type Booking = {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total_price_cents: number;
  advance_percentage: number;
  advance_amount_cents: number;
  balance_cents: number;
  service_type: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_dni: string | null;
  total_duration_minutes: number;
  confirmed_at: string | null;
  assigned_employee_id: string | null;
  created_at: string;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
};

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente (WhatsApp)",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

const statusColors: Record<string, string> = {
  pendiente: "badge-warning",
  confirmada: "badge-success",
  completada: "badge-gold",
  cancelada: "badge-error",
  expirada: "badge-neutral",
};

const paymentLabels: Record<string, string> = {
  sin_pago:  "SIN PAGO",
  pendiente: "SIN PAGO",
  parcial:   "SALDO PENDIENTE",
  total:     "PAGADO COMPLETO",
};

const paymentColors: Record<string, string> = {
  sin_pago:  "badge-error",   // ROJO
  pendiente: "badge-error",   // ROJO
  parcial:   "badge-warning", // AMARILLO
  total:     "badge-success", // VERDE
};

// Tipo para el modal de pago — resumen financiero de la reserva
interface BookingSummaryForPayment {
  id: string;
  booking_code: string;
  client_first_name: string;
  client_last_name: string;
  total_price_cents: number;
  advance_percentage?: number;
  advance_required_cents?: number;
  amount_paid_cents?: number;
  balance_cents?: number;
  payment_status?: string;
  booking_status?: string;
  payment_method?: string | null;
}

export function ReservasManager({ userRole = "admin" }: { userRole?: string }) {
  const isAdmin = userRole === "admin";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estado de modales
  const [paymentModalBooking, setPaymentModalBooking] = useState<BookingSummaryForPayment | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const loadBookings = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);

      try {
        let query = supabase
          .from("bookings")
          .select(
            "id, booking_code, booking_date, start_time, end_time, status, payment_status, payment_method, total_price_cents, advance_percentage, advance_amount_cents, balance_cents, service_type, client_first_name, client_last_name, client_phone, client_email, client_dni, total_duration_minutes, confirmed_at, assigned_employee_id, created_at"
          )
          .in("status", ["pendiente", "confirmada", "completada", "cancelada"])
          .order("booking_date", { ascending: false })
          .order("start_time", { ascending: true });

        if (filterStatus) {
          query = query.eq("status", filterStatus);
        }

        if (filterDate) {
          query = query.eq("booking_date", filterDate);
        }

        if (filterType) {
          query = query.eq("service_type", filterType);
        }

        const { data, error } = await query.limit(200);
        if (error) {
          console.error("[ReservasManager] Error consultando reservas:", error);
        } else if (data) {
          setBookings(data);
        }
      } catch (err) {
        console.error("[ReservasManager] Excepción al cargar reservas:", err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [supabase, filterStatus, filterDate, filterType]
  );

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name");
    setEmployees(data ?? []);
  }, [supabase]);

  // Carga inicial y por cambio de filtros en la vista
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Referencias mutables para mantener el canal en tiempo real aislado de re-renders de UI
  const filtersRef = useRef({ filterStatus, filterDate, filterType });
  useEffect(() => {
    filtersRef.current = { filterStatus, filterDate, filterType };
  }, [filterStatus, filterDate, filterType]);

  const loadBookingsRef = useRef(loadBookings);
  useEffect(() => {
    loadBookingsRef.current = loadBookings;
  }, [loadBookings]);

  // Suscripción protegida, autenticada y persistente a Supabase Realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        console.log("[Supabase Realtime: Bookings] 🔄 Verificando sesión de administrador...");
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          console.log("[Supabase Realtime: Bookings] 🔑 Autenticando canal Realtime con JWT de administrador...");
          supabase.realtime.setAuth(session.access_token);
        } else {
          console.warn("[Supabase Realtime: Bookings] ⚠️ No se detectó sesión activa en el cliente al iniciar Realtime.");
        }

        if (!isMounted) return;

        const channelName = "realtime-admin-bookings-changes";
        const existing = supabase.getChannels().find((c: { topic: string }) => c.topic === `realtime:${channelName}` || c.topic === channelName);
        if (existing) {
          console.log("[Supabase Realtime: Bookings] 🧹 Removiendo canal previo...");
          supabase.removeChannel(existing);
        }

        console.log("[Supabase Realtime: Bookings] 📡 Inicializando canal:", channelName);

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
              console.log("[Supabase Realtime: Bookings] ⚡ INSERT recibido:", payload.new);
              const newBooking = payload.new as unknown as Booking;
              const { filterStatus: curStatus, filterDate: curDate, filterType: curType } = filtersRef.current;

              // Actualización instantánea en pantalla
              setBookings((prev) => {
                const exists = prev.some((b) => b.id === newBooking.id || b.booking_code === newBooking.booking_code);
                if (exists) return prev;
                if (curStatus && newBooking.status !== curStatus) return prev;
                if (curDate && newBooking.booking_date !== curDate) return prev;
                if (curType && newBooking.service_type !== curType) return prev;

                const next = [newBooking, ...prev];
                return next.sort((a, b) => {
                  if (a.booking_date !== b.booking_date) {
                    return b.booking_date.localeCompare(a.booking_date);
                  }
                  return (a.start_time || "").localeCompare(b.start_time || "");
                });
              });

              // Sincronización en segundo plano
              if (loadBookingsRef.current) {
                loadBookingsRef.current(true);
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
              console.log("[Supabase Realtime: Bookings] ⚡ UPDATE recibido:", payload.new);
              const updatedBooking = payload.new as unknown as Booking;
              const { filterStatus: curStatus, filterDate: curDate, filterType: curType } = filtersRef.current;

              setBookings((prev) => {
                if (curStatus && updatedBooking.status !== curStatus) {
                  return prev.filter((b) => b.id !== updatedBooking.id);
                }
                if (curDate && updatedBooking.booking_date !== curDate) {
                  return prev.filter((b) => b.id !== updatedBooking.id);
                }
                if (curType && updatedBooking.service_type !== curType) {
                  return prev.filter((b) => b.id !== updatedBooking.id);
                }

                const exists = prev.some((b) => b.id === updatedBooking.id);
                if (exists) {
                  return prev.map((b) =>
                    b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b
                  );
                } else {
                  const next = [updatedBooking, ...prev];
                  return next.sort((a, b) => {
                    if (a.booking_date !== b.booking_date) {
                      return b.booking_date.localeCompare(a.booking_date);
                    }
                    return (a.start_time || "").localeCompare(b.start_time || "");
                  });
                }
              });

              if (loadBookingsRef.current) {
                loadBookingsRef.current(true);
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
              console.log("[Supabase Realtime: Bookings] ⚡ DELETE recibido:", payload.old);
              const deletedId = (payload.old as { id?: string })?.id;
              if (deletedId) {
                setBookings((prev) => prev.filter((b) => b.id !== deletedId));
              }

              if (loadBookingsRef.current) {
                loadBookingsRef.current(true);
              }
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
              console.log("[Supabase Realtime: Bookings] ⚡ Cambio en empleados, recargando...");
              loadEmployees();
            }
          )
          .subscribe((status: string, err?: Error | unknown) => {
            console.log(`[Supabase Realtime: Bookings] 📡 Estado de suscripción: ${status}`);
            if (status === "SUBSCRIBED") {
              console.log("[Supabase Realtime: Bookings] 🟢 Conexión activa y autenticada escuchando 'bookings'.");
              setIsRealtimeConnected(true);
            } else if (status === "CHANNEL_ERROR") {
              console.error("[Supabase Realtime: Bookings] ❌ Error en el canal Realtime:", err);
              setIsRealtimeConnected(false);
            } else if (status === "TIMED_OUT") {
              console.warn("[Supabase Realtime: Bookings] ⏱️ Timeout esperando conexión Realtime.");
              setIsRealtimeConnected(false);
            } else if (status === "CLOSED") {
              console.log("[Supabase Realtime: Bookings] 🔒 Canal Realtime cerrado.");
              setIsRealtimeConnected(false);
            }
          });
      } catch (err) {
        console.error("[Supabase Realtime: Bookings] Error inicializando suscripción:", err);
      }
    }

    initRealtime();

    const { data: authSubData } = supabase.auth.onAuthStateChange(async (_event: string, session: { access_token?: string } | null) => {
      if (session?.access_token) {
        console.log("[Supabase Realtime: Bookings] 🔄 Token renovado, actualizando Realtime auth...");
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      isMounted = false;
      authSubData?.subscription?.unsubscribe();
      if (channel) {
        console.log("[Supabase Realtime: Bookings] 🛑 Desmontando componente: Removiendo canal...");
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, loadEmployees]);


  // Actualizar estado general mediante API administrativa
  async function updateBooking(bookingId: string, payload: Record<string, unknown>) {
    setActionLoading(bookingId);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookingId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo actualizar la reserva.");
      } else {
        await loadBookings(true);
      }
    } catch {
      alert("Error de conexión al actualizar la reserva.");
    } finally {
      setActionLoading(null);
    }
  }

  // Eliminar físicamente y de forma permanente una reserva
  async function deleteBookingPermanently(booking: Booking) {
    const confirmMessage =
      `⚠️ ¿Estás seguro de ELIMINAR PERMANENTEMENTE la reserva ${booking.booking_code} de ${booking.client_first_name} ${booking.client_last_name}?\n\n` +
      `Esta acción eliminará definitivamente el registro de la base de datos. ¡No se puede deshacer!`;

    if (!confirm(confirmMessage)) return;

    setActionLoading(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings?id=${booking.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      } else {
        alert(data.error || "No se pudo eliminar la reserva.");
      }
    } catch {
      alert("Error de conexión al intentar eliminar la reserva.");
    } finally {
      setActionLoading(null);
    }
  }

  const filteredBookings = bookings.filter((b) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.booking_code.toLowerCase().includes(term) ||
      b.client_first_name.toLowerCase().includes(term) ||
      b.client_last_name.toLowerCase().includes(term) ||
      (b.client_phone && b.client_phone.includes(term)) ||
      (b.client_email && b.client_email.toLowerCase().includes(term)) ||
      (b.client_dni && b.client_dni.includes(term))
    );
  });

  const employeeMap = new Map(
    employees.map((e) => [e.id, `${e.first_name} ${e.last_name}`])
  );

  // Stats Calculations
  const pendingCount = bookings.filter((b) => b.status === "pendiente").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmada").length;
  const completedCount = bookings.filter((b) => b.status === "completada").length;

  // Ingresos cobrados: suma de pagos verificados (advance_amount_cents) en reservas activas y completadas
  // advance_amount_cents es recalculado por el trigger Postgres desde payment_logs verificados.
  const totalCollectedRevenue = bookings
    .filter((b) => ["confirmada", "completada"].includes(b.status))
    .reduce((sum, b) => sum + (b.advance_amount_cents || 0), 0);

  // Saldo pendiente por cobrar en reservas activas con pago incompleto
  const pendingRevenueToCollect = bookings
    .filter(
      (b) =>
        ["pendiente", "confirmada"].includes(b.status) &&
        b.payment_status !== "total"
    )
    .reduce((sum, b) => sum + (b.balance_cents || 0), 0);

  // Helper para abrir modal de pago
  function openPaymentModal(b: Booking) {
    const advancePct = b.advance_percentage || 25;
    const advanceRequired = Math.ceil(b.total_price_cents * advancePct / 100);
    setPaymentModalBooking({
      id: b.id,
      booking_code: b.booking_code,
      client_first_name: b.client_first_name,
      client_last_name: b.client_last_name,
      total_price_cents: b.total_price_cents,
      advance_percentage: advancePct,
      advance_required_cents: advanceRequired,
      amount_paid_cents: b.advance_amount_cents || 0,
      balance_cents: b.balance_cents !== undefined ? b.balance_cents : b.total_price_cents,
      payment_status: b.payment_status,
      booking_status: b.status,
      payment_method: b.payment_method,
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60, width: "100%", minWidth: 0 }}>
      {/* Realtime Connection Indicator Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Botón Principal Nueva Reserva (Walk-in) */}
          <button
            type="button"
            onClick={() => setIsNewBookingModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{
              fontSize: "0.8rem",
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(200, 164, 92, 0.35)",
            }}
            title="Crear una nueva reserva presencial rápida (Walk-in)"
            id="new-booking-btn"
          >
            ➕ Nueva Reserva
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Configurar titular, teléfono de Yape, QR y porcentaje de adelanto"
              id="payment-settings-btn"
            >
              ⚙️ Ajustes de Cobro / QR
            </button>
          )}

          <button
            type="button"
            onClick={() => loadBookings(false)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
            title="Forzar actualización manual de reservas"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Pendientes WhatsApp */}
        <div
          className="card card-gold"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            background: "rgba(245, 158, 11, 0.05)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(245, 158, 11, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            🟡
          </div>
          <div>
            <p
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                color: "#F59E0B",
                lineHeight: 1,
              }}
            >
              {pendingCount}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Pendientes (WhatsApp)
            </p>
          </div>
        </div>

        {/* Card 2: Confirmadas */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(106, 153, 78, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            <img src="/Activo.svg" alt="Confirmadas" style={{ width: 24, height: 24 }} />
          </div>
          <div>
            <p
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                color: "var(--color-success)",
                lineHeight: 1,
              }}
            >
              {confirmedCount}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Confirmadas
            </p>
          </div>
        </div>

        {/* Card 3: Completadas */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(200, 164, 92, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            🏁
          </div>
          <div>
            <p
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                color: "var(--color-primary)",
                lineHeight: 1,
              }}
            >
              {completedCount}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Completadas
            </p>
          </div>
        </div>

        {/* Card 4: Ingresos Cobrados */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(37, 211, 102, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            💰
          </div>
          <div>
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--color-primary)",
                lineHeight: 1,
              }}
            >
              S/ {(totalCollectedRevenue / 100).toFixed(2)}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Ingresos Cobrados
            </p>
          </div>
        </div>

        {/* Card 5: Por Cobrar en Local */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem",
            }}
          >
            ⏳
          </div>
          <div>
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "#EF4444",
                lineHeight: 1,
              }}
            >
              S/ {(pendingRevenueToCollect / 100).toFixed(2)}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Por Cobrar en Local
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
          padding: "16px 18px",
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0, width: "100%" }}>
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Código, nombre, teléfono, DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <label className="label">Estado</label>
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">🟡 Pendientes (WhatsApp)</option>
            <option value="confirmada">🟢 Confirmadas</option>
            <option value="completada">🏁 Completadas</option>
            <option value="cancelada">❌ Canceladas</option>
          </select>
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 0 }}>
          <label className="label">Fecha</label>
          <input
            type="date"
            className="input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: "1 1 130px", minWidth: 0 }}>
          <label className="label">Tipo</label>
          <select
            className="select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">Todos</option>
            <option value="barberia">Barbería</option>
            <option value="spa">Spa</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
        <button
          onClick={() => {
            setFilterStatus("");
            setFilterDate("");
            setFilterType("");
            setSearchTerm("");
          }}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 2, flex: "0 0 auto" }}
        >
          Limpiar
        </button>
      </div>

      {/* Bookings Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p className="text-muted">Cargando reservas...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📋</div>
            <p className="text-muted">
              No se encontraron reservas con los filtros aplicados.
            </p>
            <button
              type="button"
              onClick={() => setIsNewBookingModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
            >
              ➕ Crear Nueva Reserva
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: "960px", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    background: "rgba(200,164,92,0.04)",
                  }}
                >
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Código
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Cliente
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Fecha
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Hora
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Tipo
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Estado
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Pago
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    WhatsApp
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Total
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--color-text-muted)",
                      textAlign: "center",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <Fragment key={b.id}>
                    <tr
                      key={b.id}
                      style={{
                        borderBottom:
                          expandedId === b.id
                            ? "none"
                            : "1px solid var(--color-border)",
                        cursor: "pointer",
                        transition: "background var(--transition-fast)",
                      }}
                      onClick={() =>
                        setExpandedId(expandedId === b.id ? null : b.id)
                      }
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(200,164,92,0.04)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <code
                          style={{
                            color: "var(--color-primary)",
                            fontWeight: 700,
                            fontSize: "0.875rem",
                          }}
                        >
                          {b.booking_code}
                        </code>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                            {b.client_first_name} {b.client_last_name}
                          </p>
                          {b.client_phone && (
                            <p
                              className="text-muted"
                              style={{ fontSize: "0.75rem" }}
                            >
                              📱 {b.client_phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td
                        style={{ padding: "14px 16px", fontSize: "0.875rem" }}
                      >
                        {b.booking_date}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontWeight: 600,
                          fontSize: "0.9375rem",
                        }}
                      >
                        {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className="badge badge-gold"
                          style={{
                            fontSize: "0.6875rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <img
                            src={
                              b.service_type === "barberia"
                                ? "/LogoBarberia.svg"
                                : b.service_type === "spa"
                                ? "/LogoSpa.svg"
                                : "/LogoTodo.svg"
                            }
                            alt={b.service_type}
                            style={{ height: 12, width: "auto" }}
                          />
                          {b.service_type === "barberia"
                            ? "Barbería"
                            : b.service_type === "spa"
                            ? "Spa"
                            : "Mixto"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className={`badge ${
                            statusColors[b.status] || "badge-neutral"
                          }`}
                        >
                          {statusLabels[b.status] || b.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className={`badge ${
                            b.payment_status === "total"
                              ? "badge-success"
                              : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                              ? "badge-warning"
                              : "badge-error"
                          }`}
                          style={{
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            fontSize: "0.72rem",
                          }}
                        >
                          {b.payment_status === "total"
                            ? "PAGADO COMPLETO"
                            : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                            ? "SALDO PENDIENTE"
                            : "SIN PAGO"}
                        </span>

                        {/* Si es SALDO PENDIENTE, mostrar monto restante */}
                        {(b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)) && (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              color: "var(--color-warning, #f59e0b)",
                              marginTop: 4,
                              fontWeight: 600,
                            }}
                          >
                            Resta: S/ {((b.balance_cents !== undefined ? b.balance_cents : Math.max(0, b.total_price_cents - (b.advance_amount_cents || 0))) / 100).toFixed(2)}
                          </span>
                        )}

                        {/* Si es PAGADO COMPLETO, mostrar método de pago */}
                        {b.payment_method && b.payment_status === "total" && (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.7rem",
                              color: "var(--color-text-muted)",
                              marginTop: 4,
                              fontWeight: 600,
                            }}
                          >
                            {PAYMENT_METHOD_ICONS[b.payment_method as PaymentMethod] || "💳"}{" "}
                            {PAYMENT_METHOD_LABELS[b.payment_method as PaymentMethod] || b.payment_method}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {b.client_phone ? (
                          <a
                            href={`https://wa.me/51${b.client_phone.replace(
                              /\D/g,
                              ""
                            )}?text=${encodeURIComponent(
                              `Hola ${b.client_first_name}, te saludamos de Acicalados respecto a tu reserva ${b.booking_code} del ${b.booking_date} a las ${b.start_time?.slice(0, 5)}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-sm"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              background: "#25D366",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "var(--radius-sm)",
                              fontWeight: 600,
                              textDecoration: "none",
                            }}
                          >
                            <img
                              src="/icons/whatsApp.svg"
                              alt="WhatsApp"
                              style={{ width: 14, height: 14 }}
                            />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <span
                            className="text-muted"
                            style={{ fontSize: "0.8125rem" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontWeight: 700,
                          color: "var(--color-primary)",
                          fontSize: "0.9375rem",
                        }}
                      >
                        S/ {(b.total_price_cents / 100).toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                          }}
                        >
                          {/* Botón: Pagar (admin + recepcionista) */}
                          {b.status !== "cancelada" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(b);
                              }}
                              disabled={actionLoading === b.id}
                              className={`btn btn-sm ${
                                b.payment_status === "total"
                                  ? "btn-secondary"
                                  : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                                  ? "btn-secondary"
                                  : "btn-primary"
                              }`}
                              style={{
                                padding: "4px 9px",
                                fontSize: "0.73rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                ...(b.payment_status === "total"
                                  ? {
                                      background: "rgba(106, 153, 78, 0.15)",
                                      color: "var(--color-success)",
                                      borderColor: "rgba(106, 153, 78, 0.35)",
                                    }
                                  : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                                  ? {
                                      background: "rgba(245, 158, 11, 0.15)",
                                      color: "var(--color-warning, #f59e0b)",
                                      borderColor: "rgba(245, 158, 11, 0.4)",
                                    }
                                  : {}),
                              }}
                              title={
                                b.payment_status === "total"
                                  ? "Ver pago registrado"
                                  : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                                  ? `Completar saldo pendiente (S/ ${((b.balance_cents !== undefined ? b.balance_cents : Math.max(0, b.total_price_cents - (b.advance_amount_cents || 0))) / 100).toFixed(2)})`
                                  : "Registrar pago de adelanto o total"
                              }
                              id={`pay-btn-${b.id}`}
                            >
                              {b.payment_status === "total"
                                ? "✅ Pagado"
                                : b.payment_status === "parcial" || (b.advance_amount_cents > 0 && b.advance_amount_cents < b.total_price_cents)
                                ? "💳 Pagar Saldo"
                                : "💳 Pagar"}
                            </button>
                          )}

                          {/* Botón: Eliminar (solo admin, el recepcionista no lo ve) */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBookingPermanently(b);
                              }}
                              disabled={actionLoading === b.id}
                              className="btn btn-ghost btn-sm"
                              title="Eliminar reserva definitivamente"
                              style={{
                                padding: "4px 7px",
                                color: "var(--color-error)",
                                borderColor: "rgba(184,59,46,0.3)",
                                fontSize: "0.8125rem",
                              }}
                              id={`delete-btn-${b.id}`}
                            >
                              🗑️
                            </button>
                          )}

                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.75rem",
                              transition: "transform var(--transition-fast)",
                              display: "inline-block",
                              transform:
                                expandedId === b.id
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                              marginLeft: 2,
                            }}
                            title="Ver detalles de la reserva"
                          >
                            ▼
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {expandedId === b.id && (
                      <tr key={`${b.id}-detail`}>
                        <td
                          colSpan={10}
                          style={{
                            padding: 0,
                            borderBottom: "1px solid var(--color-border)",
                          }}
                        >
                          <div
                            style={{
                              padding: "16px 18px",
                              background: "rgba(200,164,92,0.03)",
                              borderTop: "1px solid var(--color-border)",
                              animation: "fadeIn 0.2s ease-out",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: 16,
                                marginBottom: 18,
                              }}
                            >
                              {/* Client Info */}
                              <div>
                                <p
                                  style={{
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    color: "var(--color-text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    marginBottom: 8,
                                  }}
                                >
                                  Datos del cliente
                                </p>
                                <p
                                  style={{
                                    fontSize: "0.875rem",
                                    marginBottom: 4,
                                  }}
                                >
                                  <strong>
                                    {b.client_first_name} {b.client_last_name}
                                  </strong>
                                </p>
                                {b.client_email && (
                                  <p
                                    className="text-muted"
                                    style={{
                                      fontSize: "0.8125rem",
                                      marginBottom: 2,
                                    }}
                                  >
                                    ✉️ {b.client_email}
                                  </p>
                                )}
                                {b.client_phone && (
                                  <p
                                    className="text-muted"
                                    style={{
                                      fontSize: "0.8125rem",
                                      marginBottom: 2,
                                    }}
                                  >
                                    📱 {b.client_phone}
                                  </p>
                                )}
                                {b.client_dni && (
                                  <p
                                    className="text-muted"
                                    style={{ fontSize: "0.8125rem" }}
                                  >
                                    🪪 DNI: {b.client_dni}
                                  </p>
                                )}
                              </div>

                              {/* Booking Info */}
                              <div>
                                <p
                                  style={{
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    color: "var(--color-text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    marginBottom: 8,
                                  }}
                                >
                                  Detalles de la cita
                                </p>
                                <p
                                  className="text-muted"
                                  style={{
                                    fontSize: "0.8125rem",
                                    marginBottom: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <img src="/calendario.svg" alt="Fecha" style={{ width: 14, height: 14, display: "inline-block" }} /> {b.booking_date}
                                </p>
                                <p
                                  className="text-muted"
                                  style={{
                                    fontSize: "0.8125rem",
                                    marginBottom: 4,
                                  }}
                                >
                                  ⏰ {b.start_time?.slice(0, 5)} –{" "}
                                  {b.end_time?.slice(0, 5)} (
                                  {formatDuration(b.total_duration_minutes)})
                                </p>
                                {b.confirmed_at && (
                                  <p
                                    className="text-muted"
                                    style={{
                                      fontSize: "0.8125rem",
                                      marginBottom: 4,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <img src="/Activo.svg" alt="Confirmada" style={{ width: 14, height: 14 }} /> Confirmada:{" "}
                                    {new Date(b.confirmed_at).toLocaleString(
                                      "es-PE"
                                    )}
                                  </p>
                                )}
                                <div style={{ marginTop: 8 }}>
                                  <label
                                    className="label"
                                    style={{ fontSize: "0.75rem" }}
                                  >
                                    Asignar Empleado:
                                  </label>
                                  <select
                                    className="select"
                                    style={{
                                      padding: "4px 8px",
                                      fontSize: "0.8125rem",
                                      maxWidth: 220,
                                    }}
                                    value={b.assigned_employee_id || ""}
                                    onChange={(e) =>
                                      updateBooking(b.id, {
                                        assigned_employee_id:
                                          e.target.value || null,
                                      })
                                    }
                                  >
                                    <option value="">Sin asignar</option>
                                    {employees.map((emp) => (
                                      <option key={emp.id} value={emp.id}>
                                        {emp.first_name} {emp.last_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* WhatsApp Contact */}
                              <div>
                                <p
                                  style={{
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    color: "var(--color-text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    marginBottom: 8,
                                  }}
                                >
                                  Contacto WhatsApp
                                </p>
                                {b.client_phone ? (
                                  <div>
                                    <p
                                      className="text-muted"
                                      style={{
                                        fontSize: "0.8125rem",
                                        marginBottom: 6,
                                      }}
                                    >
                                      Teléfono: <strong>{b.client_phone}</strong>
                                    </p>
                                    <a
                                      href={`https://wa.me/51${b.client_phone.replace(
                                        /\D/g,
                                        ""
                                      )}?text=${encodeURIComponent(
                                        `Hola ${b.client_first_name}, te saludamos de Acicalados respecto a tu cita ${b.booking_code} programada para el ${b.booking_date} a las ${b.start_time?.slice(0, 5)}.`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn btn-sm"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "6px 14px",
                                        fontSize: "0.8125rem",
                                        background: "#25D366",
                                        color: "#FFFFFF",
                                        border: "none",
                                        borderRadius: "var(--radius-sm)",
                                        fontWeight: 600,
                                        textDecoration: "none",
                                      }}
                                    >
                                      <img
                                        src="/icons/whatsApp.svg"
                                        alt="WhatsApp"
                                        style={{ width: 16, height: 16 }}
                                      />
                                      <span>Abrir Chat WhatsApp</span>
                                    </a>
                                  </div>
                                ) : (
                                  <p
                                    className="text-muted"
                                    style={{ fontSize: "0.8125rem" }}
                                  >
                                    Sin teléfono registrado
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons in Expanded Drawer */}
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                paddingTop: 16,
                                borderTop: "1px solid var(--color-border)",
                                alignItems: "center",
                              }}
                            >
                              {/* Action 1: Complete appointment */}
                              {b.status === "confirmada" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateBooking(b.id, {
                                      status: "completada",
                                    });
                                  }}
                                  disabled={actionLoading === b.id}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "8px 16px" }}
                                >
                                  {actionLoading === b.id
                                    ? "Actualizando..."
                                    : "🏁 Marcar Cita como Completada"}
                                </button>
                              )}

                              {/* Action 3: Cancel appointment */}
                              {isAdmin &&
                                b.status !== "cancelada" &&
                                b.status !== "completada" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        confirm(
                                          "¿Estás seguro de cancelar esta reserva?"
                                        )
                                      ) {
                                        updateBooking(b.id, {
                                          status: "cancelada",
                                        });
                                      }
                                    }}
                                    disabled={actionLoading === b.id}
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: "8px 16px" }}
                                  >
                                    ✕ Cancelar Reserva
                                  </button>
                                )}

                              {b.status === "completada" && (
                                <span
                                  className="badge badge-gold"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "0.8125rem",
                                  }}
                                >
                                  ✨ Servicio Completado y Cobrado
                                </span>
                              )}

                              {/* Action 4: Delete Permanently */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBookingPermanently(b);
                                  }}
                                  disabled={actionLoading === b.id}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    color: "var(--color-error)",
                                    borderColor: "rgba(184,59,46,0.3)",
                                    marginLeft: "auto",
                                  }}
                                >
                                  {actionLoading === b.id
                                    ? "Eliminando..."
                                    : "🗑️ Eliminar Definitivamente"}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result count footer */}
        {!loading && filteredBookings.length > 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(200,164,92,0.02)",
            }}
          >
            <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
              Mostrando {filteredBookings.length} reserva(s)
            </p>
            <button onClick={() => loadBookings()} className="btn btn-ghost btn-sm">
              🔄 Actualizar
            </button>
          </div>
        )}
      </div>

      {/* Modal de registro de pago */}
      {paymentModalBooking && (
        <PaymentModal
          booking={paymentModalBooking}
          userRole={userRole}
          onClose={() => setPaymentModalBooking(null)}
          onSuccess={() => {
            setPaymentModalBooking(null);
            loadBookings(true);
          }}
        />
      )}

      {/* Modal de configuración de pagos (solo admin) */}
      {isSettingsModalOpen && (
        <PaymentSettingsModal
          onClose={() => setIsSettingsModalOpen(false)}
          onSuccess={() => {
            setIsSettingsModalOpen(false);
            loadBookings(true);
          }}
        />
      )}

      {/* Modal de creación de nueva reserva presencial (Walk-in) */}
      <NewBookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        onBookingCreated={() => {
          loadBookings(false);
        }}
        employees={employees}
      />
    </div>
  );
}
