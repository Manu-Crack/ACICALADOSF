import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCatalogClient } from "./ProductCatalogClient";

export const metadata = {
  title: "Catálogo de Productos — Acicalados Spa & Barber Shop",
  description:
    "Catálogo informativo de productos profesionales para el cuidado de la barba, cabello y piel disponibles en Acicalados.",
};

export const revalidate = 60; // ISR revalidate every 60 seconds

export default async function TiendaPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, description, category, images, features")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 110, paddingBottom: 70, minHeight: "100vh" }}>
        <section className="section" style={{ background: "transparent", paddingTop: 20 }}>
          <div className="container" style={{ maxWidth: 1060 }}>
            {/* Cabecera Editorial del Catálogo */}
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <span className="badge badge-gold" style={{ letterSpacing: "0.15em", textTransform: "uppercase" }}>
                CATÁLOGO EXCLUSIVO
              </span>
              <h1
                className="heading-xl"
                style={{
                  marginTop: 14,
                  marginBottom: 10,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                }}
              >
                Nuestra Selección <span className="text-gold">Exclusiva</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto" }} />
              <p
                className="text-muted"
                style={{
                  maxWidth: 640,
                  margin: "0 auto",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                Línea de productos profesionales para el cuidado masculino, afeitado tradicional y rituales de spa. Disponibles físicamente en nuestro establecimiento.
              </p>
            </div>

            {/* Listado de Tarjetas Horizontales Informativas */}
            <ProductCatalogClient products={products || []} />

            {/* Banner Informativo de Adquisición Local */}
            <div
              className="card card-gold animate-fadeIn"
              style={{
                marginTop: 64,
                padding: "36px 28px",
                textAlign: "center",
                background: "rgba(14, 12, 8, 0.85)",
                border: "1px solid var(--color-primary-border)",
                boxShadow: "0 12px 30px rgba(0,0,0,0.6)",
              }}
            >
              <span className="badge badge-gold" style={{ marginBottom: 12 }}>
                DISPONIBILIDAD EN SALÓN
              </span>
              <h2 className="heading-md" style={{ marginBottom: 8, color: "#FFFFFF" }}>
                ¿Deseas adquirir alguno de nuestros productos?
              </h2>
              <p className="text-muted" style={{ maxWidth: 540, margin: "0 auto 24px", fontSize: "0.9375rem", lineHeight: 1.6 }}>
                Encuéntralos durante tu visita en nuestro local o coordina directamente con nuestro equipo de recepción para consultar stock físico.
              </p>
              <a
                href="https://wa.me/51997766828?text=Hola%20Acicalados,%20deseo%20consultar%20sobre%20la%20disponibilidad%20de%20productos%20de%20su%20cat%C3%A1logo."
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
                style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
              >
                <img src="/icons/whatsApp.svg" alt="WhatsApp" style={{ width: 20, height: 20 }} />
                <span>Consultar por WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
