"use client";

import { useState, useRef } from "react";

type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "barberia" | "spa";
  price_cents: number;
  duration_minutes: number;
  capacity: number;
  staff_required: number;
  is_public: boolean;
  is_active: boolean;
  images: string[];
  sort_order: number;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ServiceFormModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!service;

  const [name, setName] = useState(service?.name || "");
  const [slug, setSlug] = useState(service?.slug || "");
  const [description, setDescription] = useState(service?.description || "");
  const [type, setType] = useState<"barberia" | "spa">(service?.type || "barberia");
  const [priceSoles, setPriceSoles] = useState(
    service ? (service.price_cents / 100).toFixed(2) : ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    service?.duration_minutes?.toString() || ""
  );
  const [capacity, setCapacity] = useState(service?.capacity?.toString() || "1");
  const [staffRequired, setStaffRequired] = useState(service?.staff_required?.toString() || "1");
  const [isPublic, setIsPublic] = useState(service?.is_public ?? true);
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(service?.sort_order?.toString() || "0");
  const [images, setImages] = useState<string[]>(service?.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const slugManuallyEdited = useRef(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited.current && !isEditing) {
      setSlug(slugify(value));
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/services/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          setImages((prev) => [...prev, data.url]);
        } else {
          setError(data.error || "Error al subir imagen");
        }
      } catch {
        setError("Error de conexión al subir imagen");
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const priceCents = Math.round(parseFloat(priceSoles) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setError("El precio debe ser un número válido");
      setSaving(false);
      return;
    }

    const duration = parseInt(durationMinutes);
    if (isNaN(duration) || duration <= 0) {
      setError("La duración debe ser mayor a 0");
      setSaving(false);
      return;
    }

    const body = {
      ...(isEditing ? { id: service.id } : {}),
      name,
      slug,
      description: description || null,
      type,
      price_cents: priceCents,
      duration_minutes: duration,
      capacity: parseInt(capacity) || 1,
      staff_required: parseInt(staffRequired) || 1,
      is_public: isPublic,
      is_active: isActive,
      images,
      sort_order: parseInt(sortOrder) || 0,
    };

    try {
      const res = await fetch("/api/admin/services", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        onSaved();
      } else {
        setError(data.error || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    }

    setSaving(false);
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
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card card-gold"
        style={{
          maxWidth: 640,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 32,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="heading-md">
            {isEditing ? "Editar Servicio" : "Nuevo Servicio"}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: "1.25rem", padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(184,59,46,0.1)",
              border: "1px solid rgba(184,59,46,0.2)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-error)",
              fontSize: "0.875rem",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name & Slug */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label" htmlFor="svc-name">Nombre del servicio *</label>
              <input
                id="svc-name"
                className="input"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Corte Clásico"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="svc-slug">Slug *</label>
              <input
                id="svc-slug"
                className="input"
                value={slug}
                onChange={(e) => {
                  slugManuallyEdited.current = true;
                  setSlug(e.target.value);
                }}
                placeholder="corte-clasico"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="svc-desc">Descripción</label>
            <textarea
              id="svc-desc"
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el servicio..."
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Type & Price */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label" htmlFor="svc-type">Tipo *</label>
              <select
                id="svc-type"
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as "barberia" | "spa")}
              >
                <option value="barberia">💈 Barbería</option>
                <option value="spa">🧖‍♀️ Spa</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="svc-price">Precio (S/) *</label>
              <input
                id="svc-price"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={priceSoles}
                onChange={(e) => setPriceSoles(e.target.value)}
                placeholder="35.00"
                required
              />
            </div>
          </div>

          {/* Duration, Capacity, Staff */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label" htmlFor="svc-duration">Duración (min) *</label>
              <input
                id="svc-duration"
                className="input"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="30"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="svc-capacity">Capacidad</label>
              <input
                id="svc-capacity"
                className="input"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="svc-staff">Personal req.</label>
              <input
                id="svc-staff"
                className="input"
                type="number"
                min="1"
                value={staffRequired}
                onChange={(e) => setStaffRequired(e.target.value)}
              />
            </div>
          </div>

          {/* Sort Order */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="svc-sort">Orden de aparición</label>
            <input
              id="svc-sort"
              className="input"
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ maxWidth: 120 }}
            />
          </div>

          {/* Images */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Imágenes del servicio</label>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {images.map((url, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: 100,
                    height: 100,
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <img
                    src={url}
                    alt={`Imagen ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(184,59,46,0.9)",
                      color: "#fff",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "var(--radius-md)",
                  border: "2px dashed var(--color-border)",
                  background: "transparent",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontSize: "0.75rem",
                  transition: "border-color var(--transition-fast)",
                }}
              >
                {uploading ? (
                  <span>Subiendo...</span>
                ) : (
                  <>
                    <span style={{ fontSize: "1.5rem" }}>📷</span>
                    <span>Agregar</span>
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
            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
              JPG, PNG, WebP — máx. 5MB por imagen
            </p>
          </div>

          {/* Toggles */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              padding: "16px",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }}
              />
              Servicio activo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }}
              />
              Visible al público
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {saving
                ? "Guardando..."
                : isEditing
                  ? "💾 Guardar Cambios"
                  : "✅ Crear Servicio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
