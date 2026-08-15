"use client";

import { useState, useRef, useMemo } from "react";
import { convertToWebP } from "@/lib/utils/image-converter";
import { formatDuration } from "@/lib/utils/format";

type Service = {
  id: string;
  name: string;
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

/* ============================================================
   CATÁLOGO PREDEFINIDO DE SERVICIOS
   ============================================================ */

type CatalogEntry = {
  name: string;
  duration_minutes: number;
  price_soles: number;
};

const SPA_CATALOG: CatalogEntry[] = [
  { name: "PEDICURE", duration_minutes: 90, price_soles: 40 },
  { name: "DEPILACIÓN (PIERNA)", duration_minutes: 30, price_soles: 50 },
  { name: "DEPILACIÓN (PIERNA Y MUSLO)", duration_minutes: 45, price_soles: 70 },
  { name: "MANICURE", duration_minutes: 90, price_soles: 35 },
  { name: "ACRÍLICAS (2H 30MIN)", duration_minutes: 150, price_soles: 70 },
  { name: "ACRÍLICAS (2H)", duration_minutes: 120, price_soles: 65 },
  { name: "FACIAL PROFUNDO", duration_minutes: 90, price_soles: 80 },
  { name: "FACIAL BÁSICO", duration_minutes: 30, price_soles: 50 },
  { name: "RIZADO DE PESTAÑAS", duration_minutes: 45, price_soles: 35 },
  { name: "PIGMENTACIÓN DE CEJAS", duration_minutes: 30, price_soles: 25 },
  { name: "PESTAÑAS POSTIZAS", duration_minutes: 30, price_soles: 35 },
  { name: "PLANCHADO DE CEJAS", duration_minutes: 40, price_soles: 25 },
  { name: "TINTE BUENO (1 SOLO COLOR)", duration_minutes: 90, price_soles: 120 },
  { name: "TINTE NORMAL (1 SOLO COLOR)", duration_minutes: 90, price_soles: 100 },
  { name: "TINTE BÁSICO (1 SOLO COLOR)", duration_minutes: 90, price_soles: 80 },
  { name: "TOQUE DE RAÍZ", duration_minutes: 90, price_soles: 80 },
  { name: "BAÑO DE COLOR", duration_minutes: 60, price_soles: 80 },
  { name: "BALAGE", duration_minutes: 210, price_soles: 350 },
  { name: "ALIZADO BÁSICO", duration_minutes: 180, price_soles: 200 },
  { name: "ALIZADO DUAL (PORTUGAL)", duration_minutes: 240, price_soles: 350 },
  { name: "ALIZADO VIP", duration_minutes: 420, price_soles: 450 },
  { name: "DEPILACIÓN DE BOZO", duration_minutes: 10, price_soles: 10 },
  { name: "DEPILACIÓN DE BOZO CON HILO", duration_minutes: 10, price_soles: 10 },
  { name: "DEPILACIÓN DE BOZO CON CERA", duration_minutes: 10, price_soles: 10 },
  { name: "DEPILACIÓN FACIAL CON HILO", duration_minutes: 45, price_soles: 30 },
  { name: "DEPILACIÓN CON CERA", duration_minutes: 30, price_soles: 45 },
  { name: "BOTOX DE 150", duration_minutes: 120, price_soles: 150 },
  { name: "BOTOX DE 80", duration_minutes: 120, price_soles: 80 },
  { name: "PIGMENTACIÓN DE 3 DÍAS", duration_minutes: 4320, price_soles: 10 },
  { name: "PIGMENTACIÓN DE 2 SEMANAS", duration_minutes: 20160, price_soles: 25 },
  { name: "RAYITOS", duration_minutes: 120, price_soles: 200 },
  { name: "MECHAS + COLOR", duration_minutes: 180, price_soles: 280 },
  { name: "BALAGE + COLOR", duration_minutes: 240, price_soles: 450 },
  { name: "EXTENSIONES DE CABELLO 1", duration_minutes: 60, price_soles: 100 },
  { name: "EXTENSIONES DE CABELLO 2", duration_minutes: 180, price_soles: 700 },
  { name: "EXTENSIONES DE CABELLO 3", duration_minutes: 300, price_soles: 1000 },
  { name: "BLANQUEAMIENTO", duration_minutes: 30, price_soles: 30 },
  { name: "PESTAÑAS POSTIZAS 1X1", duration_minutes: 35, price_soles: 35 },
  { name: "PESTAÑAS POSTIZAS ANIME", duration_minutes: 25, price_soles: 25 },
  { name: "LAVADO DE CABELLO", duration_minutes: 10, price_soles: 10 },
  { name: "PLANCHADO DE CABELLO", duration_minutes: 30, price_soles: 30 },
  { name: "SECADO + PLANCHADO", duration_minutes: 45, price_soles: 30 },
  { name: "ONDULACIÓN CABELLO CORTO", duration_minutes: 120, price_soles: 50 },
  { name: "ONDULACIÓN CABELLO MEDIANO", duration_minutes: 180, price_soles: 70 },
  { name: "ONDULACIÓN CABELLO LARGO", duration_minutes: 240, price_soles: 120 },
  { name: "MICRO BLADING", duration_minutes: 120, price_soles: 250 },
  { name: "MICRO CHEADING", duration_minutes: 180, price_soles: 350 },
  { name: "LABIOS", duration_minutes: 150, price_soles: 450 },
  { name: "CEPILLADO DE CABELLO", duration_minutes: 60, price_soles: 30 },
  { name: "DELINEADO DE OJOS SUPERIOR", duration_minutes: 120, price_soles: 250 },
  { name: "DELINEADO DE OJOS BEAGLE", duration_minutes: 120, price_soles: 200 },
  { name: "DELINEADO DE OJOS INFERIOR", duration_minutes: 120, price_soles: 150 },
  { name: "YELITIPS", duration_minutes: 150, price_soles: 50 },
];

const BARBERIA_CATALOG: CatalogEntry[] = [
  { name: "CORTE CLÁSICO", duration_minutes: 30, price_soles: 20 },
  { name: "CORTE FADE", duration_minutes: 60, price_soles: 25 },
  { name: "CORTE + BARBA", duration_minutes: 60, price_soles: 30 },
  { name: "CORTE + DISEÑO", duration_minutes: 80, price_soles: 50 },
];



/* ============================================================
   COMPONENT
   ============================================================ */
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

  // For the catalog selector
  const [selectedCatalogIndex, setSelectedCatalogIndex] = useState<number>(-1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current catalog based on type
  const currentCatalog = useMemo(
    () => (type === "spa" ? SPA_CATALOG : BARBERIA_CATALOG),
    [type]
  );

  /* When selecting from catalog dropdown */
  function handleCatalogSelect(index: number) {
    setSelectedCatalogIndex(index);
    if (index === -2) {
      // "Otro / Servicio Personalizado" chosen
      setName("");
      setPriceSoles("");
      setDurationMinutes("");
      return;
    }
    if (index < 0) {
      // Reset fields if "Seleccionar..." is chosen
      setName("");
      setPriceSoles("");
      setDurationMinutes("");
      return;
    }
    const entry = currentCatalog[index];
    setName(entry.name);
    setPriceSoles(entry.price_soles.toFixed(2));
    setDurationMinutes(entry.duration_minutes.toString());
  }

  /* When switching type, reset catalog selection */
  function handleTypeChange(newType: "barberia" | "spa") {
    setType(newType);
    if (!isEditing) {
      setSelectedCatalogIndex(-1);
      setName("");
      setPriceSoles("");
      setDurationMinutes("");
    }
  }

  function handleNameChange(value: string) {
    setName(value);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    for (const file of Array.from(files)) {
      try {
        // Convertir automáticamente cualquier formato de imagen (PNG, JPG, etc.) a WebP optimizado
        const webpFile = await convertToWebP(file, name || "servicio", 0.85);

        const formData = new FormData();
        formData.append("file", webpFile);
        formData.append("serviceName", name || "servicio");

        const res = await fetch("/api/admin/services/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          setImages((prev) => [...prev, data.url]);
        } else {
          setError(data.error || "Error al subir la imagen WebP");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al procesar la imagen";
        setError(msg);
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

    if (!name.trim()) {
      setError(
        selectedCatalogIndex === -2
          ? "Por favor, ingresa el nombre del servicio personalizado"
          : "Selecciona un servicio del catálogo o elige 'Otro / Servicio Personalizado'"
      );
      setSaving(false);
      return;
    }

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
          {/* Type Selector — must be first so catalog list updates */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">Tipo de servicio *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleTypeChange("barberia")}
                className={type === "barberia" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <img src="/LogoBarberia.svg" alt="Barbería" style={{ height: 16, width: "auto" }} />
                Barbería
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("spa")}
                className={type === "spa" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <img src="/LogoSpa.svg" alt="Spa" style={{ height: 16, width: "auto" }} />
                Spa
              </button>
            </div>
          </div>

          {/* Catalog Selector (for new services) OR Name input (for editing) */}
          {!isEditing ? (
            <div style={{ marginBottom: 16 }}>
              <label className="label" htmlFor="svc-catalog">
                Seleccionar servicio del catálogo *
              </label>
              <select
                id="svc-catalog"
                className="select"
                value={selectedCatalogIndex}
                onChange={(e) => handleCatalogSelect(parseInt(e.target.value))}
                style={{
                  borderColor:
                    selectedCatalogIndex >= 0 || selectedCatalogIndex === -2
                      ? "var(--color-primary)"
                      : undefined,
                }}
              >
                <option value={-1}>— Seleccionar servicio —</option>
                {currentCatalog.map((entry, i) => (
                  <option key={`${entry.name}-${i}`} value={i}>
                    {entry.name} — {formatDuration(entry.duration_minutes)} — S/ {entry.price_soles.toFixed(2)}
                  </option>
                ))}
                <option value={-2}>➕ Otro / Servicio Personalizado</option>
              </select>

              {/* Preview card when selected from catalog */}
              {selectedCatalogIndex >= 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "14px 18px",
                    background: "rgba(200,164,92,0.06)",
                    border: "1px solid var(--color-primary-border)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    animation: "fadeIn 0.2s ease-out",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 2 }}>
                      {currentCatalog[selectedCatalogIndex].name}
                    </p>
                    <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                      ⏱️ {formatDuration(currentCatalog[selectedCatalogIndex].duration_minutes)}
                    </p>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: "1.25rem", color: "var(--color-primary)" }}>
                    S/ {currentCatalog[selectedCatalogIndex].price_soles.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Dynamic input field when 'Otro / Servicio Personalizado' is chosen */}
              {selectedCatalogIndex === -2 && (
                <div style={{ marginTop: 12, animation: "fadeIn 0.2s ease-out" }}>
                  <label className="label" htmlFor="svc-custom-name">
                    Nombre del servicio personalizado *
                  </label>
                  <input
                    id="svc-custom-name"
                    className="input"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej: Masaje Terapéutico con Piedras Calientes"
                    required
                    autoFocus
                    style={{
                      borderColor: name.trim() ? "var(--color-primary)" : undefined,
                    }}
                  />
                  <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                    Escribe el nombre del nuevo servicio para la categoría {type === "barberia" ? "Barbería" : "Spa"}.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* When editing: show name input */
            <div style={{ marginBottom: 16 }}>
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
          )}



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

          {/* Price & Duration (auto-filled but editable) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label" htmlFor="svc-price">
                Precio (S/) *
                {!isEditing && selectedCatalogIndex >= 0 && (
                  <span style={{ color: "var(--color-success)", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                    ✓ Auto
                  </span>
                )}
              </label>
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
                style={{
                  borderColor: !isEditing && selectedCatalogIndex >= 0 ? "var(--color-success)" : undefined,
                  background: !isEditing && selectedCatalogIndex >= 0 ? "rgba(106,153,78,0.06)" : undefined,
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="svc-duration">
                Duración (min) *
                {!isEditing && selectedCatalogIndex >= 0 && (
                  <span style={{ color: "var(--color-success)", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
                    ✓ Auto
                  </span>
                )}
              </label>
              <input
                id="svc-duration"
                className="input"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="30"
                required
                style={{
                  borderColor: !isEditing && selectedCatalogIndex >= 0 ? "var(--color-success)" : undefined,
                  background: !isEditing && selectedCatalogIndex >= 0 ? "rgba(106,153,78,0.06)" : undefined,
                }}
              />
            </div>
          </div>

          {/* Capacity, Staff, Sort Order */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
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
            <div>
              <label className="label" htmlFor="svc-sort">Orden</label>
              <input
                id="svc-sort"
                className="input"
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
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
              disabled={
                saving ||
                uploading ||
                (!isEditing && (selectedCatalogIndex === -1 || (selectedCatalogIndex === -2 && !name.trim())))
              }
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
