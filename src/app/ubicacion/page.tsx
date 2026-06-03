import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";

export const metadata = {
  title: "Ubicación — Acicalados Spa & Barber Shop",
  description:
    "Visítanos en nuestro local de Pichari, VRAEM. Encuentra aquí el mapa interactivo de Google Maps, dirección física, horarios de atención y contáctanos directamente.",
};

export default function UbicacionPage() {
  const businessHours = [
    { day: "Lunes", hours: "9:00 AM - 9:00 PM" },
    { day: "Martes", hours: "9:00 AM - 9:00 PM" },
    { day: "Miércoles", hours: "9:00 AM - 9:00 PM" },
    { day: "Jueves", hours: "9:00 AM - 9:00 PM" },
    { day: "Viernes", hours: "9:00 AM - 9:00 PM" },
    { day: "Sábado", hours: "9:00 AM - 9:00 PM" },
    { day: "Domingo", hours: "10:00 AM - 6:00 PM" },
  ];

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 100 }}>
        {/* Header/Intro */}
        <section className="section" style={{ paddingBottom: 40 }}>
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <span className="badge badge-gold">Contacto</span>
              <h1
                className="heading-lg"
                style={{ marginTop: 16, marginBottom: 8 }}
              >
                Nuestra <span className="text-gold">Ubicación</span>
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
                Visítanos en nuestro exclusivo y confortable establecimiento en Pichari. 
                Disfruta de la mejor atención por parte de nuestros especialistas en cortes y spa.
              </p>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section style={{ paddingBottom: 80 }}>
          <div className="container">
            <div className="grid grid-2" style={{ alignItems: "stretch", gap: 32 }}>
              
              {/* Left Column: Details & Hours */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Contact Card */}
                <div className="card card-gold">
                  <h2 className="heading-md" style={{ marginBottom: 16, color: "var(--color-primary)" }}>
                    📍 Dirección y Teléfono
                  </h2>
                  <p style={{ fontSize: "1.0625rem", fontWeight: 500, marginBottom: 8 }}>
                    Spa Acicalados Barber Shop
                  </p>
                  <p className="text-muted" style={{ marginBottom: 16, fontSize: "0.9375rem" }}>
                    Av. Kimbiri s/n (Frente a la Plaza de Armas), Pichari, VRAEM, Perú.
                  </p>
                  
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                    <a
                      href="https://maps.app.goo.gl/9ojPm9qdawhvqEYu9"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      🗺️ Abrir en Google Maps
                    </a>
                    <a
                      href="https://wa.me/+51" // Reemplazar con el número del negocio si aplica
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      💬 WhatsApp Directo
                    </a>
                  </div>
                </div>

                {/* Hours Card */}
                <div className="card card-gold" style={{ flexGrow: 1 }}>
                  <h2 className="heading-md" style={{ marginBottom: 16, color: "var(--color-primary)" }}>
                    📅 Horarios de Atención
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {businessHours.map((bh) => (
                      <div
                        key={bh.day}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          borderBottom: "1px dashed var(--color-border)",
                          paddingBottom: 6,
                          fontSize: "0.9375rem"
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{bh.day}</span>
                        <span className="text-muted">{bh.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Google Maps Embed */}
              <div style={{ minHeight: 400, display: "flex" }}>
                <div
                  className="card card-gold"
                  style={{
                    padding: 8,
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3894.970082709373!2d-73.83363162475283!3d-12.518140899188477!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x910d3d42e669f4f9%3A0x2aca54dcda907e97!2sSpa%20Acicalados%20Barber%20Shop!5e0!3m2!1sen!2spe!4v1779994257483!5m2!1sen!2spe"
                    width="100%"
                    height="100%"
                    style={{ border: 0, borderRadius: "var(--radius-md)", flexGrow: 1, minHeight: 380 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación de Acicalados Spa & Barber Shop"
                  />
                </div>
              </div>

            </div>

            {/* CTA Section */}
            <div
              style={{
                textAlign: "center",
                marginTop: 48,
                padding: 40,
                background: "rgba(200,164,92,0.05)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-primary-border)",
              }}
            >
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>
                ¿Listo para visitarnos?
              </h3>
              <p className="text-muted" style={{ marginBottom: 20 }}>
                Reserva tu cita en línea hoy mismo para asegurar tu atención sin esperas.
              </p>
              <Link href="/reservar" className="btn btn-primary btn-lg">
                📆 Reservar Cita Ahora
              </Link>
            </div>

          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
