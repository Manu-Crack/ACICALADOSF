"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Booking = {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
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
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
};

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
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
  sin_pago: "Sin pago",
  parcial: "Parcial",
  total: "Pagado",
};

const paymentColors: Record<string, string> = {
  sin_pago: "badge-error",
  parcial: "badge-warning",
  total: "badge-success",
};

export function ReservasManager() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("confirmada");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  const loadBookings = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("bookings")
      .select(
        "id, booking_code, booking_date, start_time, end_time, status, payment_status, total_price_cents, advance_amount_cents, balance_cents, service_type, client_first_name, client_last_name, client_phone, client_email, client_dni, total_duration_minutes, confirmed_at, assigned_employee_id"
      )
      .in("status", ["confirmada", "completada", "cancelada"])
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

    const { data } = await query.limit(100);
    setBookings(data ?? []);
    setLoading(false);
  }, [supabase, filterStatus, filterDate, filterType]);

  const loadEmployees = useCallback(async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name");
    setEmployees(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadBookings();
    loadEmployees();
  }, [loadBookings, loadEmployees]);

  async function updateBookingStatus(bookingId: string, newStatus: string) {
    setActionLoading(bookingId);
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "completada") {
      updates.completed_at = new Date().toISOString();
    }
    if (newStatus === "cancelada") {
      updates.cancelled_at = new Date().toISOString();
    }

    await supabase.from("bookings").update(updates).eq("id", bookingId);
    await loadBookings();
    setActionLoading(null);
  }

  async function deleteBookingPermanently(booking: Booking) {
    const confirmMessage =
      `⚠️ ¿Estás seguro de ELIMINAR PERMANENTEMENTE la reserva ${booking.booking_code} de ${booking.client_first_name} ${booking.client_last_name}?\n\n` +
      `Esta acción eliminará definitivamente el registro de la base de datos y liberará las restricciones en servicios. ¡No se puede deshacer!`;

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

  const employeeMap = new Map(employees.map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  // Stats
  const confirmedCount = bookings.filter((b) => b.status === "confirmada").length;
  const completedCount = bookings.filter((b) => b.status === "completada").length;

  const totalRevenue = bookings
    .filter((b) => b.status === "confirmada" || b.status === "completada")
    .reduce((sum, b) => sum + b.advance_amount_cents, 0);

  return (
    <div>
      {/* Stats Strip */}
      <div className="grid grid-3" style={{ marginBottom: 28 }}>
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px" }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-md)",
              background: "rgba(106,153,78,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.125rem",
            }}
          >
            ✅
          </div>
          <div>
            <p style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-success)", lineHeight: 1 }}>
              {confirmedCount}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
              Confirmadas
            </p>
          </div>
        </div>
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px" }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-md)",
              background: "rgba(200,164,92,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.125rem",
            }}
          >
            🏁
          </div>
          <div>
            <p style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-primary)", lineHeight: 1 }}>
              {completedCount}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
              Completadas
            </p>
          </div>
        </div>
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px" }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "var(--radius-md)",
              background: "rgba(200,164,92,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.125rem",
            }}
          >
            💰
          </div>
          <div>
            <p style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--color-primary)", lineHeight: 1 }}>
              S/ {(totalRevenue / 100).toFixed(2)}
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
              Ingresos cobrados
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label className="label">Buscar</label>
          <input
            className="input"
            placeholder="Código, nombre, teléfono, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label className="label">Estado</label>
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="confirmada">Confirmada</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label className="label">Fecha</label>
          <input
            type="date"
            className="input"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 0 140px" }}>
          <label className="label">Tipo</label>
          <select
            className="select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="barberia">Barbería</option>
            <option value="spa">Spa</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
        <button
          onClick={() => {
            setFilterStatus("confirmada");
            setFilterDate("");
            setFilterType("");
            setSearchTerm("");
          }}
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 2 }}
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
            <p className="text-muted">No se encontraron reservas con los filtros aplicados.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                  <>
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: expandedId === b.id ? "none" : "1px solid var(--color-border)",
                        cursor: "pointer",
                        transition: "background var(--transition-fast)",
                      }}
                      onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(200,164,92,0.04)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "14px 16px" }}>
                        <code
                          style={{
                            color: "var(--color-primary)",
                            fontWeight: 600,
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
                            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
                              📱 {b.client_phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "0.875rem" }}>
                        {b.booking_date}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: 600, fontSize: "0.9375rem" }}>
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
                        <span className={`badge ${statusColors[b.status] || "badge-neutral"}`}>
                          {statusLabels[b.status] || b.status}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span className={`badge ${paymentColors[b.payment_status] || "badge-neutral"}`}>
                          {paymentLabels[b.payment_status] || b.payment_status}
                        </span>
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
                      <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
                              padding: "4px 8px",
                              color: "var(--color-error)",
                              borderColor: "rgba(184,59,46,0.3)",
                              fontSize: "0.8125rem",
                            }}
                          >
                            🗑️
                          </button>
                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.8125rem",
                              transition: "transform var(--transition-fast)",
                              display: "inline-block",
                              transform: expandedId === b.id ? "rotate(180deg)" : "rotate(0deg)",
                            }}
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
                          colSpan={9}
                          style={{
                            padding: 0,
                            borderBottom: "1px solid var(--color-border)",
                          }}
                        >
                          <div
                            style={{
                              padding: "20px 24px",
                              background: "rgba(200,164,92,0.03)",
                              borderTop: "1px solid var(--color-border)",
                              animation: "fadeIn 0.2s ease-out",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr 1fr",
                                gap: 20,
                                marginBottom: 20,
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
                                <p style={{ fontSize: "0.875rem", marginBottom: 4 }}>
                                  <strong>{b.client_first_name} {b.client_last_name}</strong>
                                </p>
                                {b.client_email && (
                                  <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 2 }}>
                                    ✉️ {b.client_email}
                                  </p>
                                )}
                                {b.client_phone && (
                                  <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 2 }}>
                                    📱 {b.client_phone}
                                  </p>
                                )}
                                {b.client_dni && (
                                  <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
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
                                <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>
                                  📅 {b.booking_date}
                                </p>
                                <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>
                                  ⏰ {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)} ({b.total_duration_minutes} min)
                                </p>
                                {b.confirmed_at && (
                                  <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>
                                    ✅ Confirmada: {new Date(b.confirmed_at).toLocaleString("es-PE")}
                                  </p>
                                )}
                                {b.assigned_employee_id && (
                                  <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                                    👤 Empleado: <strong>{employeeMap.get(b.assigned_employee_id) || "—"}</strong>
                                  </p>
                                )}
                              </div>

                              {/* Payment Info */}
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
                                  Información de pago
                                </p>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.8125rem" }}>
                                  <span className="text-muted">Adelanto pagado:</span>
                                  <span style={{ fontWeight: 600 }}>S/ {(b.advance_amount_cents / 100).toFixed(2)}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: "0.8125rem" }}>
                                  <span className="text-muted">Saldo pendiente:</span>
                                  <span style={{ fontWeight: 600, color: b.balance_cents > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                                    S/ {(b.balance_cents / 100).toFixed(2)}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    paddingTop: 8,
                                    marginTop: 8,
                                    borderTop: "1px solid var(--color-border)",
                                    fontSize: "0.9375rem",
                                  }}
                                >
                                  <span style={{ fontWeight: 700 }}>Total:</span>
                                  <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                                    S/ {(b.total_price_cents / 100).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                paddingTop: 16,
                                borderTop: "1px solid var(--color-border)",
                              }}
                            >
                              {b.status === "confirmada" && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateBookingStatus(b.id, "completada");
                                    }}
                                    disabled={actionLoading === b.id}
                                    className="btn btn-primary btn-sm"
                                  >
                                    {actionLoading === b.id ? "Procesando..." : "🏁 Marcar Completada"}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("¿Estás seguro de cancelar esta reserva?")) {
                                        updateBookingStatus(b.id, "cancelada");
                                      }
                                    }}
                                    disabled={actionLoading === b.id}
                                    className="btn btn-danger btn-sm"
                                  >
                                    ✕ Cancelar Reserva
                                  </button>
                                </>
                              )}

                              <button
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
                                {actionLoading === b.id ? "Eliminando..." : "🗑️ Eliminar Definitivamente"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
            <button onClick={loadBookings} className="btn btn-ghost btn-sm">
              🔄 Actualizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
