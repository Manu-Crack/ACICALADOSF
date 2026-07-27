"use client";

import { useState, useEffect, useCallback } from "react";
import { ServiceFormModal } from "./ServiceFormModal";

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

export function ServicesManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "barberia" | "spa">("all");

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

  const filtered = filter === "all" ? services : services.filter((s) => s.type === filter);

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
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
        <button onClick={handleNew} className="btn btn-primary">
          + Nuevo Servicio
        </button>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p className="text-muted">Cargando servicios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>✂️</div>
          <p className="text-muted" style={{ marginBottom: 16 }}>
            No hay servicios{filter !== "all" ? ` de ${filter}` : ""} registrados aún.
          </p>
          <button onClick={handleNew} className="btn btn-primary">
            Crear primer servicio
          </button>
        </div>
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

              <div className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 16, display: "flex", gap: 16 }}>
                <span>⏱️ {service.duration_minutes} min</span>
                <span>👥 Cap: {service.capacity}</span>
                <span>📋 Orden: {service.sort_order}</span>
              </div>

              {/* Status Toggles */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => handleToggle(service, "is_active")}
                  className={`btn btn-sm ${service.is_active ? "btn-primary" : "btn-ghost"}`}
                  style={{ fontSize: "0.75rem", flex: 1 }}
                >
                  {service.is_active ? "✅ Activo" : "⏸️ Inactivo"}
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
