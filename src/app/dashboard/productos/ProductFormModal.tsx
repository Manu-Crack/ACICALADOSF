"use client";

import { useState, useRef, useEffect, useId } from "react";

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  currency: string;
  stock: number;
  is_active: boolean;
  images: string[];
  features: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ProductFormModalProps {
  product: ProductItem | null;
  onClose: () => void;
  onSave: () => void;
}

const POPULAR_CATEGORIES = [
  "Cuidado de Barba",
  "Cuidado Capilar",
  "Tratamientos Faciales",
  "Afeitado Clásico",
  "Styling & Fijación",
  "Bienestar & Spa",
  "Perfumería & Lociones",
];

export function ProductFormModal({ product, onClose, onSave }: ProductFormModalProps) {
  const isEditing = !!product;
  const modalTitleId = useId();

  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [category, setCategory] = useState(product?.category || "Cuidado de Barba");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState(product?.description || "");
  
  // Precio en Soles (para admin) y Stock interno
  const [priceSoles, setPriceSoles] = useState<string>(
    product?.price_cents !== undefined ? (product.price_cents / 100).toFixed(2) : "35.00"
  );
  const [stock, setStock] = useState<number>(product?.stock !== undefined ? product.stock : 10);
  
  // Features / Beneficios dinámicos
  const [features, setFeatures] = useState<string[]>(
    product?.features && product.features.length > 0
      ? product.features
      : ["", "", ""]
  );

  // Imágenes
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [isActive, setIsActive] = useState<boolean>(product?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(product?.sort_order || 0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !uploading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving, uploading]);

  // Manejo de Features (agregar, editar, eliminar)
  const handleFeatureChange = (index: number, value: string) => {
    setFeatures((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddFeature = () => {
    setFeatures((prev) => [...prev, ""]);
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures((prev) => prev.filter((_, i) => i !== index));
  };

  // Subida de imagen WebP obligatoria
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
      formData.append("title", name || "producto");

      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      setImages([data.url]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la imagen";
      setError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
    setImages([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("El nombre del producto es obligatorio");
      return;
    }

    const priceNumber = parseFloat(priceSoles);
    if (isNaN(priceNumber) || priceNumber < 0) {
      setError("Por favor ingresa un precio válido");
      return;
    }

    const finalCategory = (category === "Otro" ? customCategory : category).trim() || "Cuidado de Barba";
    const cleanFeatures = features.map((f) => f.trim()).filter(Boolean);

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        category: finalCategory,
        description: description.trim() || null,
        price_cents: Math.round(priceNumber * 100),
        currency: "PEN",
        stock: Math.max(0, parseInt(String(stock)) || 0),
        features: cleanFeatures,
        images: images,
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
      };

      const url = "/api/admin/products";
      const method = isEditing ? "PUT" : "POST";
      const bodyData = isEditing ? { id: product.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar el producto");
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
        padding: "16px 10px",
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
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          background: "rgba(14, 12, 8, 0.96)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.95)",
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(20, 17, 12, 0.8)",
          }}
        >
          <div>
            <h2 id={modalTitleId} className="heading-md" style={{ margin: 0, fontSize: "1.125rem" }}>
              {isEditing ? "Editar Producto del Catálogo" : "Nuevo Producto del Catálogo"}
            </h2>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 4 }}>
              Configura los beneficios en viñetas y datos internos de inventario.
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

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px 16px", flex: 1 }}>
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
            {/* Nombre */}
            <div>
              <label className="label" htmlFor="prod-name">Nombre del Producto *</label>
              <input
                id="prod-name"
                type="text"
                className="input"
                placeholder="Ej: Óleo Fortificante para Barba con Argán & Bergamota"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Categoría */}
            <div>
              <label className="label" htmlFor="prod-category">Categoría *</label>
              <select
                id="prod-category"
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

            {/* Datos Internos de Gestión (Precio y Stock) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                padding: "16px",
                background: "rgba(200, 164, 92, 0.04)",
                border: "1px solid rgba(200, 164, 92, 0.15)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div>
                <label className="label" htmlFor="prod-price" style={{ color: "var(--color-primary)" }}>
                  Precio Interno (S/) *
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-primary)", fontWeight: 700 }}>
                    S/
                  </span>
                  <input
                    id="prod-price"
                    type="number"
                    step="0.10"
                    min="0"
                    className="input"
                    value={priceSoles}
                    onChange={(e) => setPriceSoles(e.target.value)}
                    style={{ paddingLeft: 38 }}
                    required
                  />
                </div>
                <span className="text-muted" style={{ fontSize: "0.72rem", marginTop: 4, display: "block" }}>
                  (Solo visible en el panel administrativo)
                </span>
              </div>

              <div>
                <label className="label" htmlFor="prod-stock" style={{ color: "var(--color-primary)" }}>
                  Stock Disponible *
                </label>
                <input
                  id="prod-stock"
                  type="number"
                  min="0"
                  className="input"
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, parseInt(e.target.value) || 0))}
                  required
                />
                <span className="text-muted" style={{ fontSize: "0.72rem", marginTop: 4, display: "block" }}>
                  (Control de almacén interno)
                </span>
              </div>
            </div>

            {/* Imagen del Producto */}
            <div>
              <label className="label">Foto del Producto (Formato WebP Obligatorio) *</label>

              {images.length > 0 ? (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    maxHeight: "220px",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-primary-border)",
                    background: "rgba(0,0,0,0.5)",
                    marginBottom: 10,
                  }}
                >
                  <img
                    src={images[0]}
                    alt="Foto del producto"
                    style={{
                      width: "100%",
                      height: "180px",
                      objectFit: "contain",
                      padding: "8px",
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
                      style={{ background: "rgba(0,0,0,0.8)", fontSize: "0.8125rem" }}
                      disabled={uploading}
                    >
                      🔄 Cambiar Foto
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
                    padding: "28px 16px",
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
                      <span style={{ fontSize: "2rem" }}>🛍️</span>
                      <p style={{ marginTop: 8, fontSize: "0.9375rem", fontWeight: 600 }}>
                        Haz clic aquí para seleccionar la imagen del producto
                      </p>
                      <p className="text-muted" style={{ fontSize: "0.8125rem", marginTop: 4 }}>
                        El sistema la convertirá automáticamente a formato .webp.
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

            {/* Descripción */}
            <div>
              <label className="label" htmlFor="prod-desc">Descripción Corta</label>
              <textarea
                id="prod-desc"
                rows={2}
                className="input"
                placeholder="Breve introducción o resumen del producto para la tarjeta..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: "vertical", minHeight: "65px" }}
              />
            </div>

            {/* Área Dinámica de Features / Beneficios en Viñetas */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="label" style={{ marginBottom: 0 }}>
                  Beneficios y Características (Viñetas del Catálogo) *
                </label>
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span>+</span>
                  <span>Añadir Viñeta</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {features.map((feature, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--color-primary)", fontWeight: 700, fontSize: "1rem" }}>
                      ✦
                    </span>
                    <input
                      type="text"
                      className="input"
                      placeholder={`Beneficio ${idx + 1} (ej: Hidrata y suaviza sin dejar sensación grasa)`}
                      value={feature}
                      onChange={(e) => handleFeatureChange(idx, e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", fontSize: "0.875rem" }}
                    />
                    {features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(idx)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ff6b6b", padding: "6px 8px" }}
                        title="Eliminar beneficio"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Switch Activo y Orden */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border)", paddingTop: 16, flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
                />
                <label htmlFor="is_active" style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9375rem" }}>
                  Producto activo en catálogo público
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label className="label" htmlFor="prod-sort" style={{ marginBottom: 0, fontSize: "0.8125rem" }}>
                  Orden:
                </label>
                <input
                  id="prod-sort"
                  type="number"
                  className="input"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  style={{ width: "80px", padding: "6px 10px", fontSize: "0.875rem" }}
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
              marginTop: 24,
              borderTop: "1px solid var(--color-border)",
              paddingTop: 18,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              disabled={saving || uploading}
              style={{ flex: "1 1 120px" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploading}
              style={{ minWidth: "150px", flex: "1 1 150px" }}
            >
              {saving ? "Guardando..." : isEditing ? "Actualizar Producto" : "Crear Producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
