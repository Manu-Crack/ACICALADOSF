import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WardrobeClientGallery } from "./WardrobeClientGallery";

export const metadata = {
  title: "Vestuario & Trajes Exclusivos — Acicalados Spa & Barber Shop",
  description: "Explora nuestra colección de trajes, vestidos y prendas de alta costura. Alquiler y confección para toda ocasión especial.",
};

export default async function VestuarioPage() {
  const supabase = await createClient();

  // Obtener prendas de vestuario activas
  const { data: items } = await supabase
    .from("wardrobe_items")
    .select("id, name, description, section, category, images, availability_status")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  // Obtener teléfono o WhatsApp configurado en business_config
  const { data: config } = await supabase
    .from("business_config")
    .select("whatsapp_url")
    .single();

  let whatsappNumber = "51997766828";
  if (config?.whatsapp_url) {
    const extracted = config.whatsapp_url.replace(/[^0-9]/g, "");
    if (extracted && extracted.length >= 9) {
      whatsappNumber = extracted;
    }
  }

  const cleanItems = items || [];

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 110, paddingBottom: 80, minHeight: "85vh" }}>
        <section className="section">
          <div className="container">
            {/* Header Hero Section */}
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <span className="badge badge-gold" style={{ fontSize: "0.8125rem", padding: "6px 16px" }}>
                Colección Exclusiva
              </span>
              <h1 className="heading-lg" style={{ marginTop: 16, marginBottom: 12 }}>
                Nuestro Catálogo de <span className="text-gold">Vestuario</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto 20px" }} />
              <p
                className="text-muted"
                style={{
                  maxWidth: 580,
                  margin: "0 auto",
                  lineHeight: 1.7,
                  fontSize: "1rem",
                }}
              >
                Trajes, vestidos de gala y prendas de alta costura seleccionadas para que luzcas impecable en tus eventos y celebraciones más importantes.
              </p>
            </div>

            {/* Interactive Client Gallery (Hides price completely, vertical 9:16 images, WhatsApp CTA) */}
            <WardrobeClientGallery
              items={cleanItems}
              whatsappNumber={whatsappNumber}
            />

            {/* In-Salon Fitting & Custom Tailoring Banner */}
            <div
              className="card card-gold"
              style={{
                textAlign: "center",
                marginTop: 64,
                padding: "44px 24px",
                background: "radial-gradient(ellipse at center, rgba(200,164,92,0.08) 0%, rgba(20,20,20,0.95) 100%)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-primary-border)",
              }}
            >
              <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>✨</span>
              <h2 className="heading-md" style={{ marginBottom: 10 }}>
                ¿Deseas una prueba de vestuario o asesoría personalizada?
              </h2>
              <p
                className="text-muted"
                style={{
                  maxWidth: 520,
                  margin: "0 auto 24px",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                }}
              >
                Visítanos en nuestro salón para probarte las prendas o contáctanos para agendar una cita previa con nuestros estilistas.
              </p>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                  "¡Hola Acicalados! Quisiera coordinar una cita para prueba de vestuario."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 28px",
                  fontSize: "1rem",
                }}
              >
                <img
                  src="/icons/whatsApp.svg"
                  alt="WhatsApp"
                  style={{ width: 22, height: 22, objectFit: "contain" }}
                />
                <span>Coordinar Cita por WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
