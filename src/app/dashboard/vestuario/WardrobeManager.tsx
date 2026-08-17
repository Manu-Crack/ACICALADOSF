"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { WardrobeFormModal, WardrobeItem } from "./WardrobeFormModal";

import { EVENT_CATEGORIES } from "./WardrobeFormModal";

function formatGroupLetter(section?: string | null): string {
  if (!section) return "A";
  return section.replace(/^(grupo|categor[ií]a)\s*:?\s*/i, "").trim() || section;
}

export function WardrobeManager() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadWardrobe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wardrobe");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      console.error("Error al cargar vestuario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWardrobe();
  }, [loadWardrobe]);

  // Filtrado reactivo por categoría y búsqueda
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemCategory = item.category || "Bodas & Matrimonios";
      const matchesCategory =
        selectedCategory === "all" || itemCategory === selectedCategory;

      const formattedSection = formatGroupLetter(item.section);
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        query === "" ||
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.section && item.section.toLowerCase().includes(query)) ||
        formattedSection.toLowerCase() === query ||
        itemCategory.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  async function handleToggleActive(item: WardrobeItem) {
    try {
      const newStatus = !item.is_active;
      const res = await fetch("/api/admin/wardrobe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_active: newStatus }),
      });

      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_active: newStatus } : i))
        );
      }
    } catch (err) {
      console.error("Error toggling active:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta prenda de vestuario? Se borrarán sus imágenes asociadas.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/wardrobe?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
      } else {
        alert(data.error || "No se pudo eliminar el vestuario");
      }
    } catch {
      alert("Error de conexión al intentar eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  function handleEdit(item: WardrobeItem) {
    setEditingItem(item);
    setShowModal(true);
  }

  function handleNew() {
    setEditingItem(null);
    setShowModal(true);
  }

  function handleSaved() {
    setShowModal(false);
    setEditingItem(null);
    loadWardrobe();
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 60, width: "100%", minWidth: 0 }}>
      {/* Action Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flex: "1 1 280px", maxWidth: 600, width: "100%" }}>
          {/* Search bar */}
          <div style={{ position: "relative", flex: 1, minWidth: 0, width: "100%" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.9rem",
                color: "var(--color-text-muted)",
              }}
            >
              🔍
            </span>
            <input
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, categoría o letra (A, B...)..."
              style={{ paddingLeft: 34, height: 40, width: "100%" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleNew}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: "1.1rem" }}>+</span>
          <span>Nueva Prenda de Vestuario</span>
        </button>
      </div>

      {/* Category Filter Chips */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          overflowX: "auto",
          paddingBottom: 6,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button
          onClick={() => setSelectedCategory("all")}
          className={selectedCategory === "all" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
          style={{ borderRadius: "var(--radius-full)", padding: "6px 16px", flexShrink: 0 }}
        >
          Todas las categorías ({items.length})
        </button>
        {EVENT_CATEGORIES.map((cat) => {
          const count = items.filter(
            (i) => (i.category || "Bodas & Matrimonios") === cat.name
          ).length;
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={isSelected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              style={{ borderRadius: "var(--radius-full)", padding: "6px 16px", fontWeight: 600, flexShrink: 0 }}
            >
              {cat.icon} {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Items Display */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 20px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid var(--color-primary)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p className="text-muted">Cargando catálogo de vestuario...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 14 }}>👔</div>
          <h3 className="heading-sm" style={{ marginBottom: 6 }}>
            {items.length === 0
              ? "Aún no hay prendas de vestuario registradas"
              : "No se encontraron prendas con este filtro"}
          </h3>
          <p className="text-muted" style={{ maxWidth: 440, margin: "0 auto 20px", fontSize: "0.875rem" }}>
            {items.length === 0
              ? "Crea tu primera prenda con dimensiones verticales 1080 x 1920 px en formato WebP para exhibirla en el catálogo."
              : "Prueba cambiando de letra o limpiando la barra de búsqueda."}
          </p>
          <button onClick={handleNew} className="btn btn-primary">
            + Agregar primera prenda
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 20,
          }}
        >
          {filteredItems.map((item) => {
            const hasImage = item.images && item.images.length > 0;
            const price = (item.price_cents / 100).toFixed(2);
            const groupLetter = formatGroupLetter(item.section);

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 16,
                  opacity: item.is_active ? 1 : 0.65,
                  border: item.is_active
                    ? "1px solid var(--color-border)"
                    : "1px dashed var(--color-border)",
                  transition: "all var(--transition-normal)",
                }}
              >
                {/* Vertical 9:16 Image Container (1080 x 1920) */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "9/14", // Proporción vertical elegante para dashboard
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    marginBottom: 14,
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {hasImage ? (
                    <img
                      src={item.images[0]}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.3s ease",
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: 20 }}>
                      <span style={{ fontSize: "3rem", opacity: 0.3 }}>👔</span>
                      <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
                        Sin imagen
                      </p>
                    </div>
                  )}

                  {/* Group Badge overlay (Solo letra del abecedario) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "rgba(10,10,10,0.88)",
                      backdropFilter: "blur(4px)",
                      padding: "2px 10px",
                      minWidth: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      border: "1.5px solid var(--color-primary)",
                    }}
                    title={`Código / Grupo ${groupLetter}`}
                  >
                    {groupLetter}
                  </div>

                  {/* Category Badge overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "rgba(10,10,10,0.88)",
                      backdropFilter: "blur(4px)",
                      padding: "3px 8px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {item.category || "Bodas & Matrimonios"}
                  </div>

                  {/* WebP / Dimensions Indicator */}
                  {hasImage && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.8)",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.6875rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      WebP 9:16
                    </div>
                  )}
                </div>

                {/* 1. Título */}
                <h3
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    marginBottom: 4,
                    color: "var(--color-text)",
                  }}
                >
                  {item.name}
                </h3>

                {/* 2. Descripción */}
                {item.description ? (
                  <p
                    className="text-muted"
                    style={{
                      fontSize: "0.8125rem",
                      lineHeight: 1.5,
                      marginBottom: 12,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.description}
                  </p>
                ) : (
                  <p className="text-muted" style={{ fontSize: "0.8125rem", fontStyle: "italic", marginBottom: 12 }}>
                    Sin descripción.
                  </p>
                )}

                {/* 4. Precio (Admin) */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "auto",
                    paddingTop: 10,
                    borderTop: "1px solid var(--color-border)",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "block" }}>
                      Precio admin
                    </span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--color-primary)" }}>
                      S/ {price}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`btn btn-sm ${item.is_active ? "btn-primary" : "btn-ghost"}`}
                    style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    {item.is_active ? (
                      <>
                        <img src="/Activo.svg" alt="Activo" style={{ width: 14, height: 14, display: "inline-block" }} /> Activo
                      </>
                    ) : (
                      "⏸️ Oculto"
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleEdit(item)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <span>✏️</span>
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: "var(--color-error)",
                      borderColor: "rgba(184,59,46,0.3)",
                      padding: "6px 12px",
                    }}
                    title="Eliminar vestuario"
                  >
                    {deletingId === item.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <WardrobeFormModal
          item={editingItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
