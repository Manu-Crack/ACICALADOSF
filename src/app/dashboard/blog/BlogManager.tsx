"use client";

import { useState } from "react";
import Link from "next/link";
import { BlogFormModal, BlogPost } from "./BlogFormModal";

interface BlogManagerProps {
  initialPosts: BlogPost[];
}

export function BlogManager({ initialPosts }: BlogManagerProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [modalPost, setModalPost] = useState<BlogPost | null | undefined>(undefined);
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const reloadPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/blog");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Error al recargar artículos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublished = async (post: BlogPost) => {
    try {
      setActionError("");
      const res = await fetch("/api/admin/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          is_published: !post.is_published,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cambiar estado");
      }

      const updated = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar";
      setActionError(msg);
    }
  };

  const handleDelete = async (post: BlogPost) => {
    try {
      setDeleting(true);
      setActionError("");
      const res = await fetch(`/api/admin/blog?id=${post.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar el artículo");
      }

      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setDeleteConfirmPost(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar";
      setActionError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Categories list
  const categories = Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[];

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.excerpt && post.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (post.category && post.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || post.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && post.is_published) ||
      (statusFilter === "draft" && !post.is_published);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="heading-lg" style={{ margin: 0 }}>
            Gestión de <span className="text-gold">Blog</span>
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 4 }}>
            Crea, edita y publica artículos editoriales optimizados con imágenes WebP.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalPost(null)}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <span>✍️</span>
          <span>Nuevo Artículo</span>
        </button>
      </div>

      {actionError && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(184, 59, 46, 0.15)",
            border: "1px solid rgba(184, 59, 46, 0.3)",
            borderRadius: "var(--radius-md)",
            color: "#ff6b6b",
            fontSize: "0.875rem",
          }}
        >
          ⚠️ {actionError}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flex: 1, minWidth: "240px", gap: 12 }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Buscar por título, categoría o resumen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: "8px 14px", fontSize: "0.875rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "8px 32px 8px 12px", fontSize: "0.875rem", width: "auto", minWidth: "160px" }}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 32px 8px 12px", fontSize: "0.875rem", width: "auto", minWidth: "140px" }}
          >
            <option value="all">Todos los estados</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
        </div>
      </div>

      {/* Articles Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  background: "rgba(20, 18, 12, 0.6)",
                  color: "var(--color-primary)",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <th style={{ padding: "14px 16px" }}>Artículo</th>
                <th style={{ padding: "14px 16px" }}>Categoría</th>
                <th style={{ padding: "14px 16px" }}>Lectura</th>
                <th style={{ padding: "14px 16px" }}>Estado</th>
                <th style={{ padding: "14px 16px" }}>Fecha</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => {
                  const formattedDate = post.published_at
                    ? new Date(post.published_at).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Sin fecha";

                  return (
                    <tr
                      key={post.id}
                      style={{
                        borderBottom: "1px solid rgba(200, 164, 92, 0.08)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(200, 164, 92, 0.04)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Portada & Título */}
                      <td style={{ padding: "14px 16px", maxWidth: "340px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "var(--radius-sm)",
                              overflow: "hidden",
                              background: "rgba(0,0,0,0.5)",
                              border: "1px solid var(--color-border)",
                              flexShrink: 0,
                            }}
                          >
                            {post.cover_image ? (
                              <img
                                src={post.cover_image}
                                alt={post.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.2rem",
                                }}
                              >
                                📝
                              </div>
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 600,
                                color: "var(--color-text)",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={post.title}
                            >
                              {post.title}
                            </p>
                            <p
                              className="text-muted"
                              style={{
                                fontSize: "0.75rem",
                                margin: "2px 0 0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {post.excerpt || "Sin resumen"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className="badge badge-gold"
                          style={{ fontSize: "0.6875rem", whiteSpace: "nowrap" }}
                        >
                          {post.category || "General"}
                        </span>
                      </td>

                      {/* Tiempo de Lectura */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "var(--color-primary-light)" }}>
                        ⏱️ {post.reading_time || 5} min
                      </td>

                      {/* Estado */}
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(post)}
                          className={`badge ${post.is_published ? "badge-success" : "badge-neutral"}`}
                          style={{
                            cursor: "pointer",
                            border: "none",
                            padding: "4px 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                          title="Clic para cambiar estado"
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: post.is_published ? "#6A994E" : "#888",
                            }}
                          />
                          {post.is_published ? "Publicado" : "Borrador"}
                        </button>
                      </td>

                      {/* Fecha */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>
                        {formattedDate}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          {/* Ver post público */}
                          {post.is_published && (
                            <Link
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: "4px 8px", fontSize: "0.8125rem" }}
                              title="Ver en la web pública"
                            >
                              👁️
                            </Link>
                          )}

                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => setModalPost(post)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.8125rem" }}
                            title="Editar artículo"
                          >
                            ✏️ Editar
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmPost(post)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", color: "#ff6b6b" }}
                            title="Eliminar artículo"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-muted)" }}>
                    <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>📝</span>
                    {posts.length === 0 ? (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "1rem", color: "var(--color-text)" }}>
                          Aún no has creado ningún artículo de blog.
                        </p>
                        <p style={{ fontSize: "0.875rem", marginTop: 4 }}>
                          Haz clic en &quot;Nuevo Artículo&quot; para publicar tu primer post editorial.
                        </p>
                      </div>
                    ) : (
                      <p>No se encontraron artículos con los filtros aplicados.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario (Crear / Editar) */}
      {modalPost !== undefined && (
        <BlogFormModal
          post={modalPost}
          onClose={() => setModalPost(undefined)}
          onSave={() => {
            setModalPost(undefined);
            reloadPosts();
          }}
        />
      )}

      {/* Modal Confirmación de Eliminación */}
      {deleteConfirmPost && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card card-gold animate-fadeIn"
            style={{
              maxWidth: 440,
              width: "100%",
              textAlign: "center",
              padding: 28,
              background: "rgba(20, 16, 12, 0.95)",
            }}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>⚠️</span>
            <h3 className="heading-md" style={{ marginBottom: 8 }}>
              ¿Eliminar este artículo?
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 24, lineHeight: 1.5 }}>
              Estás a punto de eliminar definitivamente &ldquo;<strong style={{ color: "var(--color-text)" }}>{deleteConfirmPost.title}</strong>&rdquo;. Esta acción no se puede deshacer y borrará su imagen asociada de Storage.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmPost(null)}
                className="btn btn-ghost"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmPost)}
                className="btn btn-sm"
                style={{
                  background: "#B83B2E",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
