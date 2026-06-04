import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ServiceCard } from "@/components/services/ServiceCard";
import Link from "next/link";

export const metadata = {
  title: "Nuestros Servicios — Acicalados Spa & Barber Shop",
  description:
    "Explora nuestra gama de servicios premium de Spa y Barbería. Cortes de cabello, afeitados, tratamientos, masajes y más para tu mejor cuidado personal.",
};

export default async function ServiciosPage() {
  const supabase = await createClient();

  // Fetch active and public services
  const { data: services } = await supabase
    .from("services")
    .select("id, name, slug, description, type, price_cents, duration_minutes, images")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order");

  const barberiaServices = services?.filter((s) => s.type === "barberia") ?? [];
  const spaServices = services?.filter((s) => s.type === "spa") ?? [];

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 100 }}>
        {/* Header Section */}
        <section className="section" style={{ paddingBottom: 40 }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <span className="badge badge-gold">Carta de Experiencias</span>
              <h1
                className="heading-lg"
                style={{ marginTop: 16, marginBottom: 8 }}
              >
                Nuestros <span className="text-gold">Servicios</span>
              </h1>
              <div
                className="divider-gold"
                style={{ margin: "16px auto" }}
              />
              <p
                className="text-muted"
                style={{
                  maxWidth: 600,
                  margin: "0 auto",
                  lineHeight: 1.7,
                }}
              >
                Elige la experiencia ideal para tu cuidado personal. Contamos con especialistas en cada área y productos de la más alta calidad para garantizar tu máxima satisfacción.
              </p>
            </div>
          </div>
        </section>

        {/* Services List Section */}
        <section style={{ paddingBottom: 80 }}>
          <div className="container">
            
            {/* Barbería Section */}
            {barberiaServices.length > 0 && (
              <div style={{ marginBottom: 64 }}>
                <h2
                  className="heading-lg text-gold"
                  style={{
                    marginBottom: 28,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  <img
                    src="/LogoBarberia.svg"
                    alt="Logo Barbería"
                    style={{ height: 32, width: "auto" }}
                  />
                  Barbería
                </h2>
                <div className="grid grid-3">
                  {barberiaServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            )}

            {/* Spa Section */}
            {spaServices.length > 0 && (
              <div style={{ marginBottom: 64 }}>
                <h2
                  className="heading-lg text-gold"
                  style={{
                    marginBottom: 28,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  <img
                    src="/LogoSpa.svg"
                    alt="Logo Spa"
                    style={{ height: 32, width: "auto" }}
                  />
                  Spa y Bienestar
                </h2>
                <div className="grid grid-3">
                  {spaServices.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!services || services.length === 0) && (
              <div
                className="card card-gold"
                style={{
                  textAlign: "center",
                  padding: "80px 20px",
                  maxWidth: 600,
                  margin: "0 auto",
                }}
              >
                <p style={{ fontSize: "1.125rem", color: "var(--color-text-muted)", marginBottom: 16 }}>
                  Nuestra carta de servicios se está actualizando en este momento.
                </p>
                <p className="text-muted">
                  Por favor, regresa más tarde o ponte en contacto directo con nosotros para consultar disponibilidad.
                </p>
              </div>
            )}

            {/* Booking CTA */}
            {services && services.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 60,
                  padding: "48px 40px",
                  background: "rgba(200, 164, 92, 0.04)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-primary-border)",
                }}
              >
                <h3 style={{ fontSize: "1.375rem", fontWeight: 700, marginBottom: 12, fontFamily: "'Playfair Display', serif" }}>
                  ¿Ya elegiste tu próximo servicio?
                </h3>
                <p className="text-muted" style={{ marginBottom: 28, maxWidth: 500, margin: "0 auto 28px" }}>
                  Reserva tu cita en línea de forma rápida. Paga un 30% de adelanto con cualquier método de pago y asegura tu cupo.
                </p>
                <Link href="/reservar" className="btn btn-primary btn-lg">
                  📅 Reservar Turno Ahora
                </Link>
              </div>
            )}

          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
