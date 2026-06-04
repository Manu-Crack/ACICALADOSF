import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroImageCarousel } from "@/components/layout/HeroImageCarousel";

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch published testimonials
  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("*")
    .eq("is_published", true)
    .order("sort_order")
    .limit(6);

  // Fetch FAQ
  const { data: faqItems } = await supabase
    .from("faq_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <>
      <Navbar />
      <main>
        {/* Hero Section */}
        <section id="inicio" className="hero-section">
          {/* Background gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(200,164,92,0.06) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />
          <div className="container" style={{ position: "relative" }}>
            <div className="hero-grid">
              <div className="hero-content">
                <span
                  className="badge badge-gold"
                  style={{
                    marginBottom: 20,
                    display: "inline-flex",
                    animation: "fadeInUp 0.5s ease-out forwards",
                  }}
                >
                  Spa & Barbería Premium
                </span>
                <h1
                  className="heading-xl"
                  style={{
                    marginBottom: 20,
                    animation: "fadeInUp 0.6s ease-out 0.1s forwards",
                    opacity: 0,
                  }}
                >
                  Tu mejor versión comienza en{" "}
                  <span className="text-gold" style={{ display: "inline-flex", alignItems: "center", gap: 12, verticalAlign: "middle" }}>
                    Acicalados
                  </span>
                </h1>
                <p
                  className="text-muted"
                  style={{
                    fontSize: "1.125rem",
                    marginBottom: 40,
                    maxWidth: 580,
                    lineHeight: 1.7,
                    animation: "fadeInUp 0.6s ease-out 0.2s forwards",
                    opacity: 0,
                  }}
                >
                  Reserva en línea, paga tu adelanto y deja que nuestros especialistas
                  cuiden cada detalle. Barbería y Spa en un solo lugar.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    animation: "fadeInUp 0.6s ease-out 0.3s forwards",
                    opacity: 0,
                  }}
                >
                  <Link href="/reservar" className="btn btn-primary btn-lg">
                    Reservar Ahora
                  </Link>
                  <Link href="/servicios" className="btn btn-secondary btn-lg">
                    Ver Servicios
                  </Link>
                </div>
              </div>

              <HeroImageCarousel />
            </div>
          </div>
        </section>



        {/* CTA Section */}
        <section
          style={{
            padding: "80px 0",
            background:
              "linear-gradient(135deg, rgba(200,164,92,0.04), transparent 50%)",
          }}
        >
          <div
            className="container"
            style={{ textAlign: "center", maxWidth: 600 }}
          >
            <h2 className="heading-lg" style={{ marginBottom: 16 }}>
              ¿Listo para tu <span className="text-gold">transformación</span>?
            </h2>
            <p className="text-muted" style={{ marginBottom: 32, lineHeight: 1.7 }}>
              Reserva en línea, paga solo el 30% de adelanto y el resto al
              llegar. Tu cita te espera.
            </p>
            <Link href="/reservar" className="btn btn-primary btn-lg">
              Reservar Mi Cita
            </Link>
          </div>
        </section>

        {/* Testimonials */}
        {testimonials && testimonials.length > 0 && (
          <section className="section">
            <div className="container">
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <span className="badge badge-gold">Testimonios</span>
                <h2
                  className="heading-lg"
                  style={{ marginTop: 16, marginBottom: 8 }}
                >
                  Lo que dicen nuestros clientes
                </h2>
                <div
                  className="divider-gold"
                  style={{ margin: "16px auto" }}
                />
              </div>
              <div className="grid grid-3">
                {testimonials.map((t) => (
                  <div key={t.id} className="card card-gold">
                    <div style={{ marginBottom: 12 }}>
                      {"⭐".repeat(t.rating)}
                    </div>
                    <p
                      style={{
                        fontStyle: "italic",
                        color: "var(--color-text-muted)",
                        marginBottom: 16,
                        lineHeight: 1.7,
                      }}
                    >
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                      — {t.client_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {faqItems && faqItems.length > 0 && (
          <section className="section" style={{ background: "var(--color-bg-card)" }}>
            <div className="container" style={{ maxWidth: 720 }}>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <span className="badge badge-gold">FAQ</span>
                <h2
                  className="heading-lg"
                  style={{ marginTop: 16, marginBottom: 8 }}
                >
                  Preguntas frecuentes
                </h2>
                <div
                  className="divider-gold"
                  style={{ margin: "16px auto" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {faqItems.map((faq) => (
                  <details
                    key={faq.id}
                    style={{
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <summary
                      style={{
                        padding: "16px 20px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.9375rem",
                        listStyle: "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {faq.question}
                      <span style={{ color: "var(--color-primary)", fontSize: "1.25rem" }}>
                        +
                      </span>
                    </summary>
                    <div
                      style={{
                        padding: "0 20px 16px",
                        color: "var(--color-text-muted)",
                        lineHeight: 1.7,
                        fontSize: "0.9375rem",
                      }}
                    >
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Location / Google Maps */}
        <section id="ubicacion" className="section">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="badge badge-gold">Ubicación</span>
              <h2
                className="heading-lg"
                style={{ marginTop: 16, marginBottom: 8 }}
              >
                Encuéntranos aquí
              </h2>
              <div
                className="divider-gold"
                style={{ margin: "16px auto" }}
              />
              <a
                href="https://maps.app.goo.gl/9ojPm9qdawhvqEYu9"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 16 }}
              >
                📍 Abrir en Google Maps
              </a>
            </div>
            <div
              style={{
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                border: "1px solid var(--color-border)",
              }}
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3894.970082709373!2d-73.83363162475283!3d-12.518140899188477!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x910d3d42e669f4f9%3A0x2aca54dcda907e97!2sSpa%20Acicalados%20Barber%20Shop!5e0!3m2!1sen!2spe!4v1779994257483!5m2!1sen!2spe"
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de Acicalados Spa & Barber Shop"
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/* ServiceCard imported from @/components/services/ServiceCard */
