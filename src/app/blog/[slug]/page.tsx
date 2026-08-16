import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface BlogDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image")
    .eq("slug", slug)
    .single();

  if (!post) {
    return {
      title: "Artículo no encontrado — Acicalados",
    };
  }

  return {
    title: `${post.title} — Blog Acicalados`,
    description: post.excerpt || "Artículo editorial de Acicalados Spa & Barber Shop.",
    openGraph: {
      title: post.title,
      description: post.excerpt || "Artículo de Acicalados Spa & Barber Shop",
      images: post.cover_image ? [{ url: post.cover_image }] : [],
    },
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch current post
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!post || !post.is_published) {
    notFound();
  }

  // Fetch 3 related posts
  const { data: relatedPosts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, cover_image, category, reading_time, published_at")
    .eq("is_published", true)
    .neq("id", post.id)
    .order("published_at", { ascending: false })
    .limit(3);

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Reciente";

  const shareText = `Te recomiendo este artículo de Acicalados: ${post.title}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 110, paddingBottom: 80, minHeight: "100vh" }}>
        <article className="container" style={{ maxWidth: 840, margin: "0 auto", padding: "0 20px" }}>
          {/* Breadcrumb / Botón volver */}
          <div style={{ marginBottom: 28 }}>
            <Link
              href="/blog"
              className="btn btn-ghost btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                fontSize: "0.875rem",
              }}
            >
              <span>←</span>
              <span>Volver a todos los artículos</span>
            </Link>
          </div>

          {/* Header del Artículo */}
          <header style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span className="badge badge-gold" style={{ fontSize: "0.75rem", padding: "4px 12px" }}>
                {post.category || "Cuidado Masculino"}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                <img
                  src="/calendarioT.svg"
                  alt="Calendario"
                  style={{ width: 15, height: 15, objectFit: "contain" }}
                />
                <span>{formattedDate}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--color-primary-light)" }}>
                <img
                  src="/tiempo.svg"
                  alt="Reloj"
                  style={{ width: 15, height: 15, objectFit: "contain" }}
                />
                <span>{post.reading_time || 5} min de lectura</span>
              </div>
            </div>

            <h1
              className="heading-xl"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
                lineHeight: 1.25,
                color: "#FFFFFF",
                marginBottom: 16,
              }}
            >
              {post.title}
            </h1>

            {post.excerpt && (
              <p
                style={{
                  fontSize: "1.125rem",
                  lineHeight: 1.6,
                  color: "var(--color-paper-dark)",
                  borderLeft: "3px solid var(--color-primary)",
                  paddingLeft: 16,
                  margin: "20px 0 0",
                  fontStyle: "italic",
                }}
              >
                {post.excerpt}
              </p>
            )}
          </header>

          {/* Imagen de Portada Principal */}
          {post.cover_image && (
            <div
              style={{
                width: "100%",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                border: "1px solid var(--color-primary-border)",
                boxShadow: "0 16px 40px rgba(0,0,0,0.8)",
                marginBottom: 40,
                background: "rgba(14, 12, 8, 0.9)",
              }}
            >
              <img
                src={post.cover_image}
                alt={post.title}
                style={{
                  width: "100%",
                  maxHeight: "480px",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          )}

          {/* Contenido del Artículo */}
          <div
            className="card card-gold"
            style={{
              padding: "36px 32px",
              background: "rgba(14, 12, 8, 0.8)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              marginBottom: 48,
              fontSize: "1.05rem",
              lineHeight: 1.8,
              color: "var(--color-text)",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-line",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {post.content}
            </div>

            {/* Acciones de compartir */}
            <div
              style={{
                marginTop: 40,
                paddingTop: 24,
                borderTop: "1px solid rgba(200, 164, 92, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                ¿Te gustó este artículo? Compártelo:
              </span>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#25D366",
                  color: "#FFFFFF",
                  padding: "8px 16px",
                  fontWeight: 600,
                  textDecoration: "none",
                  borderRadius: "var(--radius-full)",
                }}
              >
                <img src="/icons/whatsApp.svg" alt="WhatsApp" style={{ width: 16, height: 16 }} />
                <span>Compartir por WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Banner de Reserva Directa */}
          <div
            className="card card-gold"
            style={{
              padding: "32px 28px",
              textAlign: "center",
              background: "linear-gradient(135deg, rgba(20, 16, 10, 0.9) 0%, rgba(35, 28, 16, 0.9) 100%)",
              border: "1px solid var(--color-primary)",
              marginBottom: 60,
            }}
          >
            <span className="badge badge-gold" style={{ marginBottom: 12 }}>
              EXPERIENCIA EXCLUSIVA
            </span>
            <h2 className="heading-md" style={{ marginBottom: 8, color: "#FFFFFF" }}>
              ¿Listo para lucir impecable?
            </h2>
            <p className="text-muted" style={{ maxWidth: 520, margin: "0 auto 20px", fontSize: "0.9375rem" }}>
              Reserva tu cita hoy mismo con nuestros maestros barberos y terapeutas especialistas.
            </p>
            <Link href="/reservar" className="btn btn-primary btn-lg">
              Reservar Mi Cita Ahora
            </Link>
          </div>

          {/* Artículos Relacionados */}
          {relatedPosts && relatedPosts.length > 0 && (
            <section>
              <div style={{ marginBottom: 24 }}>
                <h3 className="heading-md" style={{ color: "var(--color-primary)" }}>
                  Más artículos para ti
                </h3>
                <div className="divider-gold" style={{ margin: "10px 0 0" }} />
              </div>

              <div className="grid grid-3" style={{ gap: 20 }}>
                {relatedPosts.map((related) => (
                  <Link
                    key={related.id}
                    href={`/blog/${related.slug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div
                      className="card card-gold"
                      style={{
                        padding: "16px",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        background: "rgba(14, 12, 8, 0.75)",
                        transition: "all var(--transition-normal)",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                      onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      {related.cover_image && (
                        <div
                          style={{
                            width: "100%",
                            height: 120,
                            borderRadius: "var(--radius-sm)",
                            overflow: "hidden",
                            marginBottom: 12,
                          }}
                        >
                          <img
                            src={related.cover_image}
                            alt={related.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      )}
                      <span className="badge badge-gold" style={{ fontSize: "0.625rem", width: "fit-content", marginBottom: 8 }}>
                        {related.category || "General"}
                      </span>
                      <h4
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: 600,
                          color: "#fff",
                          margin: 0,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {related.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}
