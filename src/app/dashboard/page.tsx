import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Today's date
  const today = new Date().toISOString().split("T")[0];

  // Today's bookings
  const { data: todayBookings, count: todayCount } = await supabase
    .from("bookings")
    .select("id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type", { count: "exact" })
    .eq("booking_date", today)
    .in("status", ["confirmada", "completada", "pendiente"])
    .order("start_time");

  // Confirmed count
  const confirmedCount =
    todayBookings?.filter((b) => b.status === "confirmada").length ?? 0;
  const completedCount =
    todayBookings?.filter((b) => b.status === "completada").length ?? 0;
  const pendingCount =
    todayBookings?.filter((b) => b.status === "pendiente").length ?? 0;

  // This week count
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const { count: weekCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .gte("booking_date", weekStart.toISOString().split("T")[0])
    .in("status", ["confirmada", "completada"]);

  const stats: { label: string; value: number; icon: React.ReactNode; color: string }[] = [
    { label: "Citas Hoy", value: todayCount ?? 0, icon: "📅", color: "var(--color-primary)" },
    { label: "Confirmadas", value: confirmedCount, icon: <img src="/Activo.svg" alt="Confirmadas" style={{ width: 22, height: 22 }} />, color: "var(--color-success)" },
    { label: "Completadas", value: completedCount, icon: "🏁", color: "var(--color-info)" },
    { label: "Esta Semana", value: weekCount ?? 0, icon: "📊", color: "var(--color-warning)" },
  ];

  const statusLabels: Record<string, string> = {
    pendiente: "Pendiente (WhatsApp)",
    confirmada: "Confirmada",
    completada: "Completada",
  };

  const statusColors: Record<string, string> = {
    pendiente: "badge-warning",
    confirmada: "badge-success",
    completada: "badge-gold",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
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
        <Link href="/dashboard/reservas" className="btn btn-primary btn-sm">
          📋 Gestionar Reservas WhatsApp →
        </Link>
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
        <h2 className="heading-md" style={{ marginBottom: 20 }}>
          📋 Agenda del Día
        </h2>
        {todayBookings && todayBookings.length > 0 ? (
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
                {todayBookings.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
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
                      <span className="badge badge-gold" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
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
                      <span className={`badge ${b.payment_status === "total" ? "badge-success" : b.payment_status === "parcial" ? "badge-warning" : "badge-error"}`}>
                        {b.payment_status === "total" ? "Pagado" : b.payment_status === "parcial" ? "Parcial" : "Sin pago"}
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
