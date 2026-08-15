import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ProfileForm } from "./ProfileForm";
import { formatDuration } from "@/lib/utils/format";

export const metadata = {
  title: "Mi Cuenta — Acicalados",
};

export default async function MiCuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_code, booking_date, start_time, status, payment_status, total_price_cents, service_type, total_duration_minutes, comprobante_tipo, comprobante_serie, comprobante_numero, pdf_url")
    .eq("user_id", user.id)
    .in("status", ["confirmada", "completada"])
    .order("booking_date", { ascending: false })
    .limit(20);

  const statusLabels: Record<string, string> = {
    confirmada: "Confirmada",
    completada: "Completada",
  };

  const paymentLabels: Record<string, string> = {
    sin_pago: "Sin pago",
    parcial: "Parcial",
    total: "Pagado",
  };

  const statusMessages: Record<string, Record<string, string>> = {
    confirmada: {
      parcial: "Tu cita está confirmada — paga el resto al llegar",
    },
    completada: {
      parcial: "Servicio completado — tienes un saldo pendiente",
      total: "Servicio completado. ¡Gracias!",
    },
    expirada: {
      sin_pago: "Tu reserva venció por falta de pago",
    },
  };

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  async function handleUpdateProfile(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const firstName = formData.get("first_name") as string;
    const lastName = formData.get("last_name") as string;
    const phone = formData.get("phone") as string;
    const dni = formData.get("dni") as string;

    // Use admin client to bypass RLS for profile updates
    const adminClient = createAdminClient();
    await adminClient
      .from("profiles")
      .update({
        first_name: firstName?.trim() || null,
        last_name: lastName?.trim() || null,
        phone: phone?.trim() || null,
        dni: dni?.trim() || null,
        is_profile_complete: !!(firstName?.trim() && lastName?.trim() && phone?.trim() && dni?.trim()),
      })
      .eq("id", user.id);

    revalidatePath("/mi-cuenta");
  }

  return (
    <div style={{ minHeight: "100vh", padding: "100px 24px 60px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header with back button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/"
              className="btn btn-ghost btn-sm"
              style={{ padding: "6px 12px", fontSize: "0.875rem" }}
            >
              ← Atrás
            </Link>
            <div>
              <Link href="/" className="text-gold" style={{ fontWeight: 800, fontSize: "1.125rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <img
                  src="/LogoAcicalados.svg"
                  alt="Logo Acicalados"
                  style={{ height: 24, width: "auto" }}
                />
                ACICALADOS
              </Link>
              <h1 className="heading-lg" style={{ marginTop: 8 }}>Mi Cuenta</h1>
            </div>
          </div>
          <form action={handleSignOut}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Cerrar Sesión
            </button>
          </form>
        </div>

        {/* Profile Card — Editable Form */}
        <div className="card card-gold" style={{ marginBottom: 32 }}>
          <h2 className="heading-md" style={{ marginBottom: 20 }}>Datos personales</h2>
          <ProfileForm
            profile={profile}
            email={user.email || ""}
            updateAction={handleUpdateProfile}
          />
        </div>

        {/* Bookings */}
        <div className="card" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 className="heading-md">Mis Reservas</h2>
          </div>

          {bookings && bookings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bookings.map((b) => {
                const message = statusMessages[b.status]?.[b.payment_status];
                const comprobanteLabel = b.comprobante_tipo === "01" ? "Factura" : "Boleta";
                const comprobanteCodigo = b.comprobante_serie
                  ? `${comprobanteLabel} ${b.comprobante_serie}-${String(b.comprobante_numero || 1).padStart(6, "0")}`
                  : null;

                return (
                  <div
                    key={b.id}
                    style={{
                      padding: "18px 20px",
                      background: "var(--color-bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <code style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                          {b.booking_code}
                        </code>
                        <span className="badge badge-gold" style={{ display: "inline-flex", alignItems: "center", padding: "4px 8px" }}>
                          <img
                            src={b.service_type === "barberia" ? "/LogoBarberia.svg" : "/LogoSpa.svg"}
                            alt={b.service_type === "barberia" ? "Barbería" : "Spa"}
                            style={{ height: 12, width: "auto" }}
                          />
                        </span>
                        {comprobanteCodigo && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "var(--color-primary-light)",
                              background: "rgba(200, 164, 92, 0.12)",
                              border: "1px solid var(--color-primary-border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "2px 8px",
                            }}
                          >
                            🧾 {comprobanteCodigo}
                          </span>
                        )}
                      </div>
                      <span className={`badge ${b.status === "confirmada" ? "badge-success" : b.status === "completada" ? "badge-gold" : b.status === "cancelada" || b.status === "expirada" ? "badge-error" : "badge-warning"}`}>
                        {statusLabels[b.status]}
                      </span>
                    </div>

                    <p className="text-muted" style={{ fontSize: "0.875rem" }}>
                      📅 {b.booking_date} · ⏰ {b.start_time?.slice(0, 5)}{b.total_duration_minutes ? ` · ⏱️ ${formatDuration(b.total_duration_minutes)}` : ""} · S/ {(b.total_price_cents / 100).toFixed(2)}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                      <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                        Pago: <strong style={{ color: "var(--color-text)" }}>{paymentLabels[b.payment_status]}</strong>
                      </p>

                      {b.pdf_url && (
                        <a
                          href={b.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            fontSize: "0.8125rem",
                            textDecoration: "none",
                          }}
                        >
                          📄 Descargar PDF
                        </a>
                      )}
                    </div>

                    {message && (
                      <p style={{ fontSize: "0.8125rem", marginTop: 10, padding: "8px 12px", background: "rgba(200,164,92,0.05)", borderRadius: "var(--radius-sm)", color: "var(--color-primary)" }}>
                        {message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 32 }}>
              <p className="text-muted">Aún no tienes reservas confirmadas.</p>
              <Link href="/reservar" className="btn btn-primary" style={{ marginTop: 16 }}>
                Reservar Ahora
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
