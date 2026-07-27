import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Tienda — Acicalados Spa & Barber Shop",
  description: "Productos de belleza, cuidado personal y accesorios disponibles en nuestra tienda.",
};

export default async function TiendaPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, description, category, price_cents, stock, images")
    .eq("is_active", true)
    .order("sort_order");

  // Group by category
  const categories = new Map<string, typeof products>();
  products?.forEach((p) => {
    const cat = p.category || "General";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(p);
  });

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 100 }}>
        <section className="section">
          <div className="container">
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <span className="badge badge-gold">Tienda</span>
              <h1 className="heading-lg" style={{ marginTop: 16, marginBottom: 8 }}>
                Nuestra <span className="text-gold">Tienda</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto" }} />
              <p className="text-muted" style={{ maxWidth: 480, margin: "0 auto" }}>
                Productos de cuidado personal y belleza. Adquiérelos presencialmente o coordina por WhatsApp.
              </p>
            </div>

            {products && products.length > 0 ? (
              Array.from(categories.entries()).map(([category, items]) => (
                <div key={category} style={{ marginBottom: 48 }}>
                  <h2 className="heading-md" style={{ marginBottom: 20 }}>
                    {category}
                  </h2>
                  <div className="grid grid-4">
                    {items?.map((product) => (
                      <div key={product.id} className="card card-gold" style={{ display: "flex", flexDirection: "column" }}>
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1",
                            borderRadius: "var(--radius-md)",
                            marginBottom: 12,
                            background:
                              product.images.length > 0
                                ? `url(${product.images[0]}) center/cover`
                                : "linear-gradient(135deg, var(--color-bg), rgba(200,164,92,0.1))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {product.images.length === 0 && (
                            <span style={{ fontSize: "2rem", opacity: 0.3 }}>🛍️</span>
                          )}
                        </div>
                        <h4 className="heading-sm" style={{ marginBottom: 4, fontSize: "0.9375rem" }}>
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-muted" style={{ fontSize: "0.8125rem", lineHeight: 1.6, marginBottom: 12, flex: 1 }}>
                            {product.description}
                          </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
                          <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                            S/ {(product.price_cents / 100).toFixed(2)}
                          </span>
                          <span className={`badge ${product.stock > 0 ? "badge-success" : "badge-error"}`}>
                            {product.stock > 0 ? "En stock" : "Agotado"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p className="text-muted" style={{ fontSize: "1.125rem" }}>
                  Próximamente disponible.
                </p>
              </div>
            )}

            {/* WhatsApp CTA */}
            <div style={{ textAlign: "center", marginTop: 20, padding: 40, background: "rgba(200,164,92,0.05)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-primary-border)" }}>
              <p style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>
                ¿Quieres algún producto?
              </p>
              <p className="text-muted" style={{ marginBottom: 20 }}>
                Adquiérelo en nuestro local o coordina por WhatsApp
              </p>
              <a
                href="https://wa.me/51997766828"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <img src="/icons/whatsApp.svg" alt="WhatsApp" style={{ width: 22, height: 22, objectFit: "contain" }} />
                <span>Consultar Disponibilidad</span>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
