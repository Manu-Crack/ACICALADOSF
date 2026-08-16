"use client";

import { useState, useRef, useEffect, useId } from "react";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image: string | null;
  category: string | null;
  reading_time: number | null;
  is_published: boolean;
  published_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface BlogFormModalProps {
  post: BlogPost | null;
  onClose: () => void;
  onSave: () => void;
}

const POPULAR_CATEGORIES = [
  "Cuidado Masculino",
  "Tendencias & Estilo",
  "Barbería Clásica",
  "Tratamientos Faciales",
  "Bienestar & Spa",
  "Consejos de Moda",
  "Salud Capilar",
];

export function BlogFormModal({ post, onClose, onSave }: BlogFormModalProps) {
  const isEditing = !!post;
  const modalTitleId = useId();

  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [category, setCategory] = useState(post?.category || "Cuidado Masculino");
  const [customCategory, setCustomCategory] = useState("");
  const [readingTime, setReadingTime] = useState<number>(post?.reading_time || 5);
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [content, setContent] = useState(post?.content || "");
  const [coverImage, setCoverImage] = useState<string>(post?.cover_image || "");
  const [isPublished, setIsPublished] = useState<boolean>(post?.is_published ?? true);
  const [publishedAt, setPublishedAt] = useState<string>(
    post?.published_at
      ? new Date(post.published_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [sortOrder, setSortOrder] = useState<number>(post?.sort_order || 0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculate reading time when content changes
  const calculateReadingTime = () => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 180));
    setReadingTime(minutes);
  };

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !uploading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving, uploading]);

  // Handle image upload with auto-conversion to WebP via backend
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setError("La imagen no debe superar los 12MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || "articulo");

      const res = await fetch("/api/admin/blog/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      setCoverImage(data.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la imagen";
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setCoverImage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("El título del artículo es obligatorio");
      return;
    }

    if (!content.trim()) {
      setError("El contenido del artículo es obligatorio");
      return;
    }

    const finalCategory = (category === "Otro" ? customCategory : category).trim() || "Cuidado Masculino";

    setSaving(true);
    setError("");

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        category: finalCategory,
        reading_time: Number(readingTime) || 5,
        excerpt: excerpt.trim() || null,
        content: content.trim(),
        cover_image: coverImage.trim() || null,
        is_published: isPublished,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        sort_order: Number(sortOrder) || 0,
      };

      const url = "/api/admin/blog";
      const method = isEditing ? "PUT" : "POST";
      const bodyData = isEditing ? { id: post.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar el artículo");
      }

      onSave();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !uploading) onClose();
      }}
    >
      <div
        className="card card-gold animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        style={{
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          background: "rgba(14, 12, 8, 0.95)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.95)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(20, 17, 12, 0.8)",
          }}
        >
          <div>
            <h2 id={modalTitleId} className="heading-md" style={{ margin: 0 }}>
              {isEditing ? "Editar Artículo de Blog" : "Nuevo Artículo de Blog"}
            </h2>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 4 }}>
              Completa la información editorial y la imagen de portada optimizada en WebP.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploading}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "1.25rem", padding: "4px 10px" }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "24px", flex: 1 }}>
          {error && (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(184, 59, 46, 0.15)",
                border: "1px solid rgba(184, 59, 46, 0.3)",
                borderRadius: "var(--radius-md)",
                color: "#ff6b6b",
                fontSize: "0.875rem",
                marginBottom: 20,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            {/* Título */}
            <div>
              <label className="label" htmlFor="blog-title">Título del Artículo *</label>
              <input
                id="blog-title"
                type="text"
                className="input"
                placeholder="Ej: Guía definitiva para el cuidado de la barba en verano"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Fila: Categoría y Tiempo de Lectura */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div>
                <label className="label" htmlFor="blog-category">Categoría *</label>
                <select
                  id="blog-category"
                  className="select"
                  value={POPULAR_CATEGORIES.includes(category) ? category : "Otro"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Otro") {
                      setCategory("Otro");
                      if (!customCategory) setCustomCategory("");
                    } else {
                      setCategory(val);
                    }
                  }}
                >
                  {POPULAR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Otro">Otro (Personalizado)...</option>
                </select>
                {(category === "Otro" || !POPULAR_CATEGORIES.includes(category)) && (
                  <input
                    type="text"
                    className="input"
                    placeholder="Escribe la categoría personalizada"
                    value={customCategory || (category !== "Otro" ? category : "")}
                    onChange={(e) => {
                      setCustomCategory(e.target.value);
                      setCategory(e.target.value);
                    }}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label className="label" htmlFor="blog-reading-time" style={{ marginBottom: 0 }}>
                    Tiempo de Lectura (minutos) *
                  </label>
                  <button
                    type="button"
                    onClick={calculateReadingTime}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: "0.75rem", padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    title="Calcular según cantidad de palabras en el contenido"
                  >
                    <img src="/Reloj.svg" alt="Auto-calcular" style={{ width: 13, height: 13, display: "inline-block" }} /> Auto-calcular
                  </button>
                </div>
                <input
                  id="blog-reading-time"
                  type="number"
                  min="1"
                  max="120"
                  className="input"
                  value={readingTime}
                  onChange={(e) => setReadingTime(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ marginTop: 6 }}
                  required
                />
              </div>
            </div>

            {/* Imagen de Portada (Cover Image) */}
            <div>
              <label className="label">Imagen de Portada (Formato WebP Obligatorio) *</label>
              
              {coverImage ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    maxHeight: "240px",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-primary-border)",
                    background: "rgba(0,0,0,0.5)",
                    marginBottom: 10,
                  }}
                >
                  <img
                    src={coverImage}
                    alt="Portada del artículo"
                    style={{
                      width: "100%",
                      height: "200px",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                      style={{ background: "rgba(0,0,0,0.75)", fontSize: "0.8125rem" }}
                      disabled={uploading}
                    >
                      🔄 Cambiar Imagen
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="btn btn-sm"
                      style={{ background: "rgba(184, 59, 46, 0.85)", color: "#fff", border: "none", fontSize: "0.8125rem" }}
                      disabled={uploading}
                    >
                      🗑️ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: "2px dashed var(--color-primary-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "32px 16px",
                    textAlign: "center",
                    cursor: uploading ? "wait" : "pointer",
                    background: "rgba(200, 164, 92, 0.03)",
                    transition: "all var(--transition-fast)",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--color-primary-border)")}
                >
                  {uploading ? (
                    <div>
                      <span style={{ fontSize: "1.5rem" }}>⏳</span>
                      <p style={{ marginTop: 8, fontSize: "0.9375rem", color: "var(--color-primary)" }}>
                        Optimizando y subiendo imagen WebP a Supabase...
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: "2rem" }}>📸</span>
                      <p style={{ marginTop: 8, fontSize: "0.9375rem", fontWeight: 600 }}>
                        Haz clic aquí para seleccionar la imagen de portada
                      </p>
                      <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 4 }}>
                        Acepta JPG, PNG, WEBP, AVIF. El sistema la procesará y optimizará automáticamente en WebP.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />
            </div>

            {/* Extracto */}
            <div>
              <label className="label" htmlFor="blog-excerpt">Extracto / Resumen corto</label>
              <textarea
                id="blog-excerpt"
                rows={2}
                className="input"
                placeholder="Breve resumen que se mostrará en la tarjeta del blog (1-2 oraciones)..."
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                style={{ resize: "vertical", minHeight: "65px" }}
              />
            </div>

            {/* Contenido completo */}
            <div>
              <label className="label" htmlFor="blog-content">Contenido del Artículo *</label>
              <textarea
                id="blog-content"
                rows={9}
                className="input"
                placeholder="Escribe aquí el contenido completo del artículo. Puedes usar párrafos y texto enriquecido..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ resize: "vertical", minHeight: "180px", fontFamily: "inherit" }}
                required
              />
            </div>

            {/* Fila: Estado de Publicación, Fecha y Orden */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, alignItems: "center", borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
              {/* Checkbox Publicado */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="is_published"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
                />
                <label htmlFor="is_published" style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9375rem" }}>
                  Publicar artículo
                </label>
              </div>

              {/* Fecha de publicación */}
              <div>
                <label className="label" htmlFor="blog-published-at" style={{ fontSize: "0.75rem" }}>Fecha de Publicación</label>
                <input
                  id="blog-published-at"
                  type="datetime-local"
                  className="input"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  style={{ padding: "8px 12px", fontSize: "0.875rem" }}
                />
              </div>

              {/* Orden */}
              <div>
                <label className="label" htmlFor="blog-sort-order" style={{ fontSize: "0.75rem" }}>Orden de prioridad</label>
                <input
                  id="blog-sort-order"
                  type="number"
                  className="input"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  style={{ padding: "8px 12px", fontSize: "0.875rem" }}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 28,
              borderTop: "1px solid var(--color-border)",
              paddingTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={saving || uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploading}
              style={{ minWidth: "140px" }}
            >
              {saving ? "Guardando..." : isEditing ? "Actualizar Post" : "Crear Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
