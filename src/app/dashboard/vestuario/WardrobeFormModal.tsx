"use client";

import { useState, useRef } from "react";
import { convertToWebP } from "@/lib/utils/image-converter";

export type WardrobeItem = {
  id: string;
  name: string;
  description: string | null;
  section: string;
  category?: string | null;
  price_cents: number;
  deposit_cents?: number;
  guarantee_cents?: number;
  availability_status: string;
  is_active: boolean;
  images: string[];
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export const EVENT_CATEGORIES = [
  { name: "Bodas & Matrimonios", icon: "💍", desc: "Novios, novias, padrinos y pajecitos" },
  { name: "Quinceañeras", icon: "👑", desc: "Vestidos de 15 años y acompañantes" },
  { name: "Gala & Noche", icon: "🍷", desc: "Smokings, trajes elegantes y vestidos de gala" },
  { name: "Trajes Típicos & Costumbristas", icon: "🎭", desc: "Danzas, folclore y trajes tradicionales" },
  { name: "Casual & Sesiones de Fotos", icon: "📸", desc: "Outfits modernos, urbanos y producciones" },
] as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function WardrobeFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: WardrobeItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!item;

  const [name, setName] = useState(item?.name || "");
  const [description, setDescription] = useState(item?.description || "");
  const [category, setCategory] = useState<string>(
    item?.category || "Bodas & Matrimonios"
  );
  const [section, setSection] = useState(
    item?.section ? item.section.replace(/^(grupo|categor[ií]a)\s*:?\s*/i, "").trim().toUpperCase() : "A"
  );

  const [priceSoles, setPriceSoles] = useState(
    item ? (item.price_cents / 100).toFixed(2) : "0.00"
  );
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [images, setImages] = useState<string[]>(item?.images || []);

  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");
    setUploadProgressText("Optimizando y convirtiendo a WebP (1080x1920)...");

    for (const file of Array.from(files)) {
      try {
        // Convertir automáticamente a WebP optimizado con soporte para 1080x1920 vertical
        const webpFile = await convertToWebP(file, name || "vestuario", 0.88, {
          maxWidth: 1080,
          maxHeight: 1920,
          fitVertical: true,
        });

        setUploadProgressText("Subiendo al Storage de Supabase...");

        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("title", name || "vestuario");

        const res = await fetch("/api/admin/wardrobe/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          // Reemplazar imagen principal o agregar a lista
          setImages((prev) => [...prev, data.url]);
        } else {
          setError(data.error || "Error al subir la imagen");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar la imagen";
        setError(msg);
      }
    }

    setUploading(false);
    setUploadProgressText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!name.trim()) {
      setError("El título del vestuario es obligatorio");
      setSaving(false);
      return;
    }

    const finalSection = section.trim().toUpperCase() || "A";

    const priceCents = Math.round(parseFloat(priceSoles || "0") * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setError("El precio debe ser un número válido mayor o igual a 0");
      setSaving(false);
      return;
    }

    const body = {
      ...(isEditing ? { id: item.id } : {}),
      name: name.trim(),
      description: description.trim() || null,
      section: finalSection,
      category: category.trim() || "Bodas & Matrimonios",
      price_cents: priceCents,
      images,
      is_active: isActive,
      sort_order: item?.sort_order ?? 0,
      availability_status: item?.availability_status || "disponible",
    };

    try {
      const res = await fetch("/api/admin/wardrobe", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        setError(data.error || "Error al guardar el vestuario");
      }
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        padding: "16px 10px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card card-gold"
        style={{
          maxWidth: 680,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "20px 18px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-primary-border)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 className="heading-md" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.125rem" }}>
              <span>👔</span>
              <span>{isEditing ? "Editar Prenda de Vestuario" : "Nueva Prenda de Vestuario"}</span>
            </h2>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 4 }}>
              Configura los datos del catálogo y sube imágenes verticales (1080 x 1920 px) en formato WebP.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "1.25rem", padding: "4px 8px", color: "var(--color-text-muted)" }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(184,59,46,0.12)",
              border: "1px solid rgba(184,59,46,0.3)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-error)",
              fontSize: "0.875rem",
              marginBottom: 20,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 1. Título */}
          <div style={{ marginBottom: 18 }}>
            <label className="label" htmlFor="w-title">
              1. Título de la prenda / vestuario *
            </label>
            <input
              id="w-title"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Terno Smoking Slim Fit Azul Noche"
              required
            />
          </div>

          {/* 2. Categoría del Evento (Obligatorio - 5 Opciones) */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label className="label" style={{ marginBottom: 0 }}>
                2. Categoría del Evento *
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 600 }}>
                {category}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 8,
              }}
            >
              {EVENT_CATEGORIES.map((cat) => {
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: isSelected
                        ? "2px solid var(--color-primary)"
                        : "1px solid var(--color-border)",
                      background: isSelected
                        ? "rgba(200,164,92,0.12)"
                        : "rgba(255,255,255,0.02)",
                      color: isSelected ? "var(--color-primary)" : "var(--color-text)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.85rem", marginBottom: 2 }}>
                      <span style={{ fontSize: "1.05rem" }}>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </div>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", lineHeight: 1.2 }}>
                      {cat.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Letra del Abecedario / Código Interno */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label className="label" htmlFor="w-section" style={{ marginBottom: 0 }}>
                3. Código Interno (Letra del Abecedario A-Z) *
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--color-primary)", fontWeight: 600 }}>
                Letra asignada: <strong style={{ fontSize: "1rem", color: "#fff", background: "var(--color-primary)", padding: "1px 8px", borderRadius: "var(--radius-sm)" }}>{section || "A"}</strong>
              </span>
            </div>

            {/* Manual input for letter of alphabet */}
            <div style={{ marginBottom: 10 }}>
              <input
                id="w-section"
                className="input"
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                placeholder="Escribe la letra manualmente (ej. A, B, C...)"
                maxLength={5}
                style={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  letterSpacing: "0.05em",
                }}
                required
              />
            </div>

            {/* Alphabet Quick Picker Buttons */}
            <div>
              <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: 6 }}>
                O pulsa una letra para asignarla rápidamente:
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  maxHeight: 110,
                  overflowY: "auto",
                  padding: "8px 6px",
                  background: "rgba(0,0,0,0.25)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {ALPHABET.map((letter) => {
                  const isSelected = section.toUpperCase() === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setSection(letter)}
                      className={isSelected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                      style={{
                        width: 32,
                        height: 32,
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.875rem",
                        fontWeight: isSelected ? 800 : 600,
                        borderRadius: "var(--radius-sm)",
                        border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                      }}
                      title={`Grupo ${letter}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Descripción */}
          <div style={{ marginBottom: 18 }}>
            <label className="label" htmlFor="w-desc">
              4. Descripción
            </label>
            <textarea
              id="w-desc"
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el corte, material, complementos incluidos, tallas disponibles..."
              style={{ resize: "vertical" }}
            />
          </div>

          {/* 5. Precio (Admin) */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="label" htmlFor="w-price" style={{ marginBottom: 0 }}>
                5. Precio de referencia (S/) *
              </label>
              <span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>
                🔒 Solo visible en Administrador (Oculto al cliente)
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-primary)",
                  fontWeight: 700,
                }}
              >
                S/
              </span>
              <input
                id="w-price"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={priceSoles}
                onChange={(e) => setPriceSoles(e.target.value)}
                placeholder="150.00"
                style={{ paddingLeft: 40 }}
                required
              />
            </div>
          </div>

          {/* 6. Imagen con Uploader WebP y soporte vertical 1080 x 1920 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label className="label" style={{ marginBottom: 0 }}>
                6. Imagen del vestuario (Vertical 1080 x 1920 px) *
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--color-primary)" }}>
                ✨ Convierte automáticamente a .WebP
              </span>
            </div>

            {/* Visual Preview / Upload Box */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 14,
                marginBottom: 10,
              }}
            >
              {images.map((url, index) => (
                <div
                  key={index}
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "9/16", // Relación 1080 x 1920
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-primary-border)",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                    background: "var(--color-bg)",
                  }}
                >
                  <img
                    src={url}
                    alt={`Vestuario ${index + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 4,
                      left: 4,
                      background: "rgba(0,0,0,0.75)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.65rem",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                    }}
                  >
                    9:16 WebP
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(184,59,46,0.9)",
                      color: "#fff",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    }}
                    title="Eliminar imagen"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Upload Trigger Area */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  width: "100%",
                  aspectRatio: "9/16",
                  borderRadius: "var(--radius-md)",
                  border: "2px dashed var(--color-primary-border)",
                  background: "rgba(200,164,92,0.03)",
                  color: "var(--color-text-muted)",
                  cursor: uploading ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: 12,
                  textAlign: "center",
                  transition: "all var(--transition-fast)",
                }}
              >
                {uploading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        border: "2px solid var(--color-primary)",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "var(--color-primary)" }}>
                      {uploadProgressText || "Procesando..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: "2rem" }}>📸</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text)" }}>
                      Subir Imagen
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
                      Vertical (1080 x 1920)
                    </span>
                  </>
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
              Formatos soportados: JPG, PNG, WebP. Optimización y reescalado vertical automático a <strong>1080 x 1920 px</strong> (.webp).
            </p>
          </div>

          {/* Activo / Inactivo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }}
              />
              Mostrar prenda activa en el catálogo público
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              style={{ flex: "1 1 120px" }}
              disabled={saving || uploading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading || !name.trim()}
              className="btn btn-primary"
              style={{ flex: "2 1 180px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {saving ? (
                <span>Guardando...</span>
              ) : isEditing ? (
                <>
                  <span>💾</span>
                  <span>Guardar Cambios</span>
                </>
              ) : (
                <>
                  <img src="/Activo.svg" alt="Activo" style={{ width: 16, height: 16, display: "inline-block" }} />
                  <span>Publicar Vestuario</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
