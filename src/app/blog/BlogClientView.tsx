"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export interface PublicBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string | null;
  reading_time: number | null;
  published_at: string | null;
}

interface BlogClientViewProps {
  posts: PublicBlogPost[];
}

export function BlogClientView({ posts }: BlogClientViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [visibleCount, setVisibleCount] = useState<number>(6);
  const [readingPost, setReadingPost] = useState<PublicBlogPost | null>(null);

  // Close overlay on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReadingPost(null);
    };
    if (readingPost) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [readingPost]);

  // Extract unique categories
  const categories = [
    "Todos",
    ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[],
  ];

  // Filter posts by category
  const filteredPosts =
    selectedCategory === "Todos"
      ? posts
      : posts.filter((p) => p.category === selectedCategory);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 6);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(6);
                }}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{
                  borderRadius: "var(--radius-full)",
                  padding: "6px 18px",
                  fontSize: "0.84rem",
                  fontWeight: isActive ? 700 : 500,
                  transition: "all var(--transition-fast)",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid de Tarjetas de Artículos (Superposición interactiva sin redirigir) */}
      {displayedPosts.length > 0 ? (
        <div className="grid grid-3" style={{ gap: 28 }}>
          {displayedPosts.map((post) => {
            const formattedDate = post.published_at
              ? new Date(post.published_at).toLocaleDateString("es-PE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Reciente";

            const readingMinutes = post.reading_time || 5;

            return (
              <div
                key={post.id}
                onClick={() => setReadingPost(post)}
                style={{ cursor: "pointer", display: "flex" }}
                className="group"
                role="button"
                tabIndex={0}
                aria-label={`Leer artículo: ${post.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setReadingPost(post);
                  }
                }}
              >
                <article
                  className="card card-gold"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    padding: 0,
                    overflow: "hidden",
                    background: "rgba(14, 12, 8, 0.75)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid var(--color-border)",
                    transition: "all var(--transition-normal)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-primary-border)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 30px rgba(0,0,0,0.7), 0 0 15px rgba(200,164,92,0.15)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "var(--shadow-card)";
                  }}
                >
                  {/* Imagen de Portada (Aspect Ratio 16:9) */}
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "16/9",
                      position: "relative",
                      overflow: "hidden",
                      background: "rgba(20, 18, 12, 0.9)",
                    }}
                  >
                    {post.cover_image ? (
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transition: "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2.5rem",
                          background:
                            "radial-gradient(circle at center, rgba(200,164,92,0.1) 0%, rgba(10,10,10,0.9) 100%)",
                        }}
                      >
                        📝
                      </div>
                    )}
                  </div>

                  {/* Cuerpo de la Tarjeta */}
                  <div
                    style={{
                      padding: "20px 22px 18px",
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                    }}
                  >
                    {/* Etiqueta de Categoría debajo de la imagen */}
                    <div style={{ marginBottom: 12 }}>
                      <span
                        className="badge badge-gold"
                        style={{
                          fontSize: "0.6875rem",
                          letterSpacing: "0.08em",
                          padding: "4px 10px",
                        }}
                      >
                        {post.category || "Cuidado Masculino"}
                      </span>
                    </div>

                    {/* Título */}
                    <h3
                      className="heading-sm"
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        lineHeight: 1.35,
                        marginBottom: 10,
                        color: "#FFFFFF",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        transition: "color var(--transition-fast)",
                      }}
                    >
                      {post.title}
                    </h3>

                    {/* Extracto / Descripción corta */}
                    <p
                      className="text-muted"
                      style={{
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        marginBottom: 20,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        flex: 1,
                      }}
                    >
                      {post.excerpt || post.content.slice(0, 140) + "..."}
                    </p>

                    {/* Footer de la Tarjeta: Icono Calendario + Fecha y Icono Reloj + Tiempo de lectura */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 14,
                        borderTop: "1px solid rgba(200, 164, 92, 0.15)",
                        marginTop: "auto",
                        fontSize: "0.8125rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {/* Fecha de Publicación */}
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <img
                          src="/calendarioT.svg"
                          alt="Fecha de publicación"
                          style={{ width: 16, height: 16, objectFit: "contain" }}
                        />
                        <span>{formattedDate}</span>
                      </div>

                      {/* Tiempo de Lectura */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          color: "var(--color-primary-light)",
                        }}
                      >
                        <img
                          src="/tiempo.svg"
                          alt="Tiempo de lectura"
                          style={{ width: 16, height: 16, objectFit: "contain" }}
                        />
                        <span>{readingMinutes} min de lectura</span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div
          className="card card-gold animate-fadeIn"
          style={{
            textAlign: "center",
            padding: "80px 24px",
            maxWidth: 600,
            margin: "0 auto",
            background: "rgba(14, 12, 8, 0.8)",
          }}
        >
          <span style={{ fontSize: "3rem", display: "block", marginBottom: 16 }}>✍️</span>
          <h3 className="heading-md" style={{ marginBottom: 8, color: "var(--color-primary)" }}>
            Pronto publicaremos nuevos artículos
          </h3>
          <p className="text-muted" style={{ marginBottom: 28, lineHeight: 1.6 }}>
            Estamos preparando guías de estilo, consejos de afeitado y las últimas tendencias en spa y
            barbería para ti.
          </p>
          <Link href="/servicios" className="btn btn-primary btn-lg">
            Explorar Nuestros Servicios
          </Link>
        </div>
      )}

      {/* Botón Inferior "Ver más artículos ->" */}
      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            type="button"
            onClick={handleLoadMore}
            className="btn btn-secondary btn-lg"
            style={{
              padding: "12px 32px",
              fontSize: "0.95rem",
              fontWeight: 600,
              borderRadius: "var(--radius-full)",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>Ver más artículos</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* ============================================================
          MODAL DE LECTURA SUPERPUESTA (OVERLAY IN SITU)
          ============================================================ */}
      {readingPost && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
            animation: "fadeIn 0.25s ease-out",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReadingPost(null);
          }}
        >
          <div
            className="card card-gold animate-fadeIn"
            style={{
              maxWidth: "840px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 0,
              background: "rgba(14, 12, 8, 0.96)",
              boxShadow: "0 25px 70px rgba(0,0,0,0.95), 0 0 30px rgba(200,164,92,0.2)",
              border: "1px solid var(--color-primary-border)",
              borderRadius: "var(--radius-lg)",
              position: "relative",
            }}
          >
            {/* Barra superior fija del modal */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: "rgba(18, 15, 10, 0.95)",
                backdropFilter: "blur(10px)",
                padding: "14px 24px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span className="badge badge-gold" style={{ fontSize: "0.75rem", padding: "4px 10px" }}>
                  {readingPost.category || "Cuidado Masculino"}
                </span>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "0.8125rem",
                    color: "var(--color-primary-light)",
                  }}
                >
                  <img
                    src="/tiempo.svg"
                    alt="Tiempo de lectura"
                    style={{ width: 14, height: 14, objectFit: "contain" }}
                  />
                  <span>{readingPost.reading_time || 5} min de lectura</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReadingPost(null)}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: "1.25rem",
                  padding: "4px 12px",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(200, 164, 92, 0.1)",
                  color: "#FFFFFF",
                }}
                aria-label="Cerrar artículo"
              >
                ✕
              </button>
            </div>

            {/* Contenido Completo del Artículo */}
            <div style={{ padding: "28px 32px 40px" }}>
              {/* Fecha y Meta */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.8125rem",
                  color: "var(--color-text-muted)",
                  marginBottom: 12,
                }}
              >
                <img
                  src="/calendarioT.svg"
                  alt="Fecha"
                  style={{ width: 15, height: 15, objectFit: "contain" }}
                />
                <span>
                  {readingPost.published_at
                    ? new Date(readingPost.published_at).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Fecha reciente"}
                </span>
              </div>

              {/* Título Principal */}
              <h2
                className="heading-xl"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "clamp(1.6rem, 3.2vw, 2.3rem)",
                  lineHeight: 1.28,
                  color: "#FFFFFF",
                  marginBottom: 16,
                }}
              >
                {readingPost.title}
              </h2>

              {/* Extracto */}
              {readingPost.excerpt && (
                <p
                  style={{
                    fontSize: "1.05rem",
                    lineHeight: 1.6,
                    color: "var(--color-paper-dark)",
                    borderLeft: "3px solid var(--color-primary)",
                    paddingLeft: 16,
                    margin: "18px 0 24px",
                    fontStyle: "italic",
                  }}
                >
                  {readingPost.excerpt}
                </p>
              )}

              {/* Imagen de Portada Principal */}
              {readingPost.cover_image && (
                <div
                  style={{
                    width: "100%",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-primary-border)",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.8)",
                    marginBottom: 28,
                    background: "rgba(14, 12, 8, 0.9)",
                  }}
                >
                  <img
                    src={readingPost.cover_image}
                    alt={readingPost.title}
                    style={{
                      width: "100%",
                      maxHeight: "420px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}

              {/* Texto completo del artículo */}
              <div
                style={{
                  whiteSpace: "pre-line",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  fontSize: "1.02rem",
                  lineHeight: 1.8,
                  color: "var(--color-text)",
                  borderBottom: "1px solid rgba(200, 164, 92, 0.2)",
                  paddingBottom: 28,
                }}
              >
                {readingPost.content}
              </div>

              {/* Acciones de WhatsApp y Cita */}
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Te recomiendo este artículo de Acicalados: ${readingPost.title}`
                  )}`}
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

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setReadingPost(null)}
                    className="btn btn-ghost btn-sm"
                  >
                    Cerrar
                  </button>
                  <Link href="/reservar" className="btn btn-primary btn-sm">
                    Reservar Cita
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
