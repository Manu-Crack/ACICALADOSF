import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogClientView } from "./BlogClientView";

export const metadata = {
  title: "Nuestro Blog — Acicalados Spa & Barber Shop",
  description:
    "Descubre consejos de belleza masculina, tendencias en cortes, cuidado de la barba, tratamientos faciales y bienestar.",
};

export const revalidate = 60; // ISR revalidate every 60 seconds

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, content, cover_image, category, reading_time, published_at")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 110, paddingBottom: 60, minHeight: "100vh" }}>
        <section className="section" style={{ background: "transparent", paddingTop: 20 }}>
          <div className="container">
            {/* Cabecera Editorial Premium */}
            <div style={{ textAlign: "center", marginBottom: 44 }}>
              <span className="badge badge-gold" style={{ letterSpacing: "0.15em", textTransform: "uppercase" }}>
                BLOG
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
                Nuestro <span className="text-gold">Blog</span>
              </h1>
              <div className="divider-gold" style={{ margin: "16px auto" }} />
              <p
                className="text-muted"
                style={{
                  maxWidth: 620,
                  margin: "0 auto",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                Consejos exclusivos de barbería clásica, guías de estilo, salud capilar y rituales de spa para elevar tu imagen al máximo nivel.
              </p>
            </div>

            {/* Grid de Artículos con Tarjetas Enriquecidas */}
            <BlogClientView posts={posts || []} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
