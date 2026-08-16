"use client";

import { useState } from "react";
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

      {/* Grid de Tarjetas de Artículos */}
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
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                style={{ textDecoration: "none", color: "inherit", display: "flex" }}
                className="group"
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
                    e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.7), 0 0 15px rgba(200,164,92,0.15)";
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
                          background: "radial-gradient(circle at center, rgba(200,164,92,0.1) 0%, rgba(10,10,10,0.9) 100%)",
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
                      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--color-primary-light)" }}>
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
              </Link>
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
            Estamos preparando guías de estilo, consejos de afeitado y las últimas tendencias en spa y barbería para ti.
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
    </div>
  );
}
