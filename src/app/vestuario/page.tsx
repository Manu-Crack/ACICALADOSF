import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Vestuario — Acicalados Spa & Barber Shop",
  description: "Explora nuestro catálogo de vestuario. Alquiler y venta de trajes y prendas para toda ocasión.",
};

export default async function VestuarioPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("wardrobe_items")
    .select("id, name, description, section, price_cents, availability_status, images")
    .eq("is_active", true)
    .order("sort_order");

  const statusLabels: Record<string, string> = {
    disponible: "Disponible",
    reservado: "Reservado",
    en_uso: "En uso",
    en_mantenimiento: "En mantenimiento",
  };

  const statusColors: Record<string, string> = {
    disponible: "badge-success",
    reservado: "badge-warning",
    en_uso: "badge-gold",
    en_mantenimiento: "badge-neutral",
  };

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 100 }}>
        <section className="section">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="badge badge-gold">Vestuario</span>
              <h1 className="heading-lg" style={{ marginTop: 16, marginBottom: 8 }}>
                Nuestro Catálogo de <span className="text-gold">Vestuario</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto" }} />
              <p className="text-muted" style={{ maxWidth: 540, margin: "0 auto", lineHeight: 1.7 }}>
                Trajes y prendas para cada ocasión. La coordinación y adquisición
                se realiza presencialmente o a través de nuestro WhatsApp.
              </p>
              <a
                href="https://wa.me/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ marginTop: 24 }}
              >
                💬 Coordinar por WhatsApp
              </a>
            </div>

            {items && items.length > 0 ? (
              <div className="grid grid-3">
                {items.map((item) => (
                  <div key={item.id} className="card card-gold" style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "3/4",
                        borderRadius: "var(--radius-md)",
                        marginBottom: 16,
                        overflow: "hidden",
                        background:
                          item.images.length > 0
                            ? `url(${item.images[0]}) center/cover`
                            : "linear-gradient(135deg, var(--color-bg), rgba(200,164,92,0.1))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.images.length === 0 && (
                        <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>👔</span>
                      )}
                    </div>
                    <h3 className="heading-sm" style={{ marginBottom: 4 }}>{item.name}</h3>
                    {item.section && (
                      <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 8 }}>
                        {item.section}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16, flex: 1 }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                      <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                        S/ {(item.price_cents / 100).toFixed(2)}
                      </span>
                      <span className={`badge ${statusColors[item.availability_status] || "badge-neutral"}`}>
                        {statusLabels[item.availability_status] || item.availability_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p className="text-muted" style={{ fontSize: "1.125rem" }}>
                  Próximamente disponible.
                </p>
              </div>
            )}

            {/* WhatsApp CTA */}
            <div style={{ textAlign: "center", marginTop: 48, padding: 40, background: "rgba(200,164,92,0.05)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-primary-border)" }}>
              <p style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>
                ¿Te interesa alguna prenda?
              </p>
              <p className="text-muted" style={{ marginBottom: 20 }}>
                Coordina tu reserva directamente con nosotros
              </p>
              <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                💬 Escribir por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
