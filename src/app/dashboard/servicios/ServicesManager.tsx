"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ServiceFormModal } from "./ServiceFormModal";
import { formatDuration } from "@/lib/utils/format";
import { filterAndSortServices } from "@/lib/utils/service-search";

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
  created_at?: string;
};

export function ServicesManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "barberia" | "spa">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/services");
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch {
      console.error("Error loading services");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  async function handleToggle(service: Service, field: "is_active" | "is_public") {
    const res = await fetch("/api/admin/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: service.id, [field]: !service[field] }),
    });
    if (res.ok) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, [field]: !s[field] } : s))
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar este servicio? Esta acción no se puede deshacer.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/services?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setServices((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert(data.error || "No se pudo eliminar el servicio");
      }
    } catch {
      alert("Error de conexión al intentar eliminar el servicio");
    } finally {
      setDeleting(null);
    }
  }

  function handleEdit(service: Service) {
    setEditingService(service);
    setShowModal(true);
  }

  function handleNew() {
    setEditingService(null);
    setShowModal(true);
  }

  function handleSaved() {
    setShowModal(false);
    setEditingService(null);
    loadServices();
  }

  // Filtrado reactivo multicriterio y ordenamiento correlativo de menor a mayor
  const filtered = useMemo(() => {
    return filterAndSortServices(services, filter, searchQuery);
  }, [services, filter, searchQuery]);

  const totalCategoryServices = useMemo(() => {
    return filter === "all"
      ? services.length
      : services.filter((s) => s.type === filter).length;
  }, [services, filter]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {/* Cabecera Superior: Barra de Búsqueda Inteligente y Acciones */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Fila 1: Input de Búsqueda y Botón Nuevo Servicio */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: 280,
            }}
          >
            {/* Icono de Lupa */}
            <span
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                color: "var(--color-primary, #c8a45c)",
                opacity: 0.8,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>

            {/* Campo de Búsqueda */}
            <input
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchQuery("");
              }}
              placeholder="Buscar por nombre de servicio o precio (ej: Fade, Botox, 20)..."
              style={{
                paddingLeft: 42,
                paddingRight: isSearching ? 40 : 16,
                height: 44,
                width: "100%",
                fontSize: "0.9375rem",
                borderRadius: "var(--radius-md)",
                transition: "all var(--transition-fast)",
              }}
            />

            {/* Botón para limpiar campo con un solo clic */}
            {isSearching && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Limpiar búsqueda (Esc)"
                aria-label="Limpiar búsqueda"
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  transition: "all var(--transition-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.color = "var(--color-text-muted)";
                }}
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={handleNew}
            className="btn btn-primary"
            style={{ height: 44, whiteSpace: "nowrap" }}
          >
            + Nuevo Servicio
          </button>
        </div>

        {/* Fila 2: Filtros de Tipo y Contador de Resultados */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(["all", "barberia", "spa"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {f === "barberia" && (
                  <img src="/LogoBarberia.svg" alt="Barbería" style={{ height: 14, width: "auto" }} />
                )}
                {f === "spa" && (
                  <img src="/LogoSpa.svg" alt="Spa" style={{ height: 14, width: "auto" }} />
                )}
                {f === "all" ? "Todos" : f === "barberia" ? "Barbería" : "Spa"}
              </button>
            ))}
          </div>

          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            {isSearching ? (
              <span>
                Mostrando <strong style={{ color: "var(--color-primary)" }}>{filtered.length}</strong> de {totalCategoryServices} servicios
              </span>
            ) : (
              <span>
                Total: <strong style={{ color: "var(--color-text)" }}>{filtered.length}</strong> servicios
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="text-muted">Cargando servicios...</p>
        </div>
      ) : filtered.length === 0 ? (
        isSearching ? (
          /* Estado Vacío por Búsqueda Sin Coincidencias */
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "48px 24px",
              maxWidth: 520,
              margin: "24px auto",
            }}
          >
            <div style={{ fontSize: "2.75rem", marginBottom: 12 }}>🔍</div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>
              No se encontraron servicios que coincidan con la búsqueda
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 20 }}>
              No hay coincidencias para &ldquo;<strong>{searchQuery.trim()}</strong>&rdquo;
              {filter !== "all" ? ` en la sección de ${filter === "barberia" ? "Barbería" : "Spa"}` : ""}.
              Intenta con otro término o consulta por el precio del servicio.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="btn btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              ✕ Limpiar búsqueda
            </button>
          </div>
        ) : (
          /* Estado Vacío General */
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>✂️</div>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              No hay servicios{filter !== "all" ? ` de ${filter}` : ""} registrados aún.
            </p>
            <button onClick={handleNew} className="btn btn-primary">
              Crear primer servicio
            </button>
          </div>
        )
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filtered.map((service) => (
            <div
              key={service.id}
              className="card"
              style={{
                opacity: service.is_active ? 1 : 0.6,
                transition: "opacity var(--transition-normal)",
              }}
            >
              {/* Image */}
              <div
                style={{
                  height: 160,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  marginBottom: 16,
                  background: "var(--color-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {service.images?.length > 0 ? (
                  <img
                    src={service.images[0]}
                    alt={service.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <img
                    src={service.type === "barberia" ? "/LogoBarberia.svg" : "/LogoSpa.svg"}
                    alt={service.type === "barberia" ? "Barbería" : "Spa"}
                    style={{ width: 48, height: "auto", opacity: 0.3 }}
                  />
                )}
              </div>

              {/* Info */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>
                    {service.name}
                  </h3>
                  <span className="badge badge-gold" style={{ fontSize: "0.6875rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <img
                      src={service.type === "barberia" ? "/LogoBarberia.svg" : "/LogoSpa.svg"}
                      alt={service.type === "barberia" ? "Barbería" : "Spa"}
                      style={{ height: 10, width: "auto" }}
                    />
                    {service.type === "barberia" ? "Barbería" : "Spa"}
                  </span>
                </div>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "1.125rem",
                    color: "var(--color-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  S/ {(service.price_cents / 100).toFixed(2)}
                </p>
              </div>

              {service.description && (
                <p
                  className="text-muted"
                  style={{
                    fontSize: "0.8125rem",
                    marginBottom: 12,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {service.description}
                </p>
              )}

              <div className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <img src="/Reloj.svg" alt="Duración" style={{ width: 14, height: 14, display: "inline-block" }} /> {formatDuration(service.duration_minutes)}
                </span>
                <span>👥 Cap: {service.capacity}</span>
                <span>📋 Orden: {service.sort_order}</span>
              </div>

              {/* Status Toggles */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => handleToggle(service, "is_active")}
                  className={`btn btn-sm ${service.is_active ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                >
                  {service.is_active ? (
                    <>
                      <img src="/Activo.svg" alt="Activo" style={{ width: 14, height: 14, display: "inline-block" }} /> Activo
                    </>
                  ) : (
                    "⏸️ Inactivo"
                  )}
                </button>
                <button
                  onClick={() => handleToggle(service, "is_public")}
                  className={`btn btn-sm ${service.is_public ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", flex: 1 }}
                >
                  {service.is_public ? "👁️ Público" : "🔒 Oculto"}
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEdit(service)}
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  disabled={deleting === service.id}
                  className="btn btn-ghost btn-sm"
                  style={{
                    flex: 1,
                    color: "var(--color-error)",
                    borderColor: "rgba(184,59,46,0.3)",
                  }}
                >
                  {deleting === service.id ? "..." : "🗑️ Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ServiceFormModal
          service={editingService}
          onClose={() => { setShowModal(false); setEditingService(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
