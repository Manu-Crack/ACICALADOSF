"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { WardrobeFormModal, WardrobeItem } from "./WardrobeFormModal";

import { EVENT_CATEGORIES } from "./WardrobeFormModal";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

  // Buscador Dual
  const [searchMode, setSearchMode] = useState<"general" | "group">("general");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Lightbox Modal para visualización ampliada
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    name: string;
    category?: string | null;
    section?: string | null;
    price_cents: number;
  } | null>(null);

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

  // Cierre de lightbox con tecla Escape y bloqueo de scroll
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    }
    if (lightboxImage) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [lightboxImage]);

  // Conteo de prendas por letra para la barra A-Z
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const letter = formatGroupLetter(item.section).toUpperCase();
      counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Filtrado reactivo por categoría, modo y búsqueda
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemCategory = item.category || "Bodas & Matrimonios";
      const matchesCategory =
        selectedCategory === "all" || itemCategory === selectedCategory;

      if (!matchesCategory) return false;

      if (searchMode === "group") {
        if (!selectedGroup || selectedGroup === "all") return true;
        const groupLetter = formatGroupLetter(item.section).toUpperCase();
        return groupLetter === selectedGroup.toUpperCase();
      } else {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const formattedSection = formatGroupLetter(item.section);
        return (
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          (item.section && item.section.toLowerCase().includes(query)) ||
          formattedSection.toLowerCase() === query ||
          itemCategory.toLowerCase().includes(query)
        );
      }
    });
  }, [items, selectedCategory, searchMode, searchQuery, selectedGroup]);

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
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Selector de Modo de Búsqueda (Buscador Dual) */}
        <div
          style={{
            display: "inline-flex",
            background: "rgba(0,0,0,0.4)",
            padding: 4,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSearchMode("general");
              setSelectedGroup("all");
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: searchMode === "general" ? "var(--color-primary)" : "transparent",
              color: searchMode === "general" ? "#000000" : "var(--color-text-muted)",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <span>🔍</span>
            <span>Búsqueda General</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchMode("group");
              setSearchQuery("");
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: searchMode === "group" ? "var(--color-primary)" : "transparent",
              color: searchMode === "group" ? "#000000" : "var(--color-text-muted)",
              fontWeight: 700,
              fontSize: "0.8125rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
          >
            <span>🔤</span>
            <span>Filtro por Grupos (A-Z)</span>
          </button>
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

      {/* Barra de Filtro según el modo seleccionado */}
      <div style={{ marginBottom: 20 }}>
        {searchMode === "general" ? (
          /* Modo 1: Búsqueda General por Texto */
          <div style={{ position: "relative", width: "100%", maxWidth: 600 }}>
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
              placeholder="Buscar por nombre, descripción o categoría..."
              style={{ paddingLeft: 36, height: 42, width: "100%" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          /* Modo 2: Filtro por Grupos (Código Interno A-Z) */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={selectedGroup === "all" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              style={{
                borderRadius: "var(--radius-sm)",
                padding: "6px 14px",
                fontWeight: 700,
                fontSize: "0.78rem",
                flexShrink: 0,
              }}
            >
              Todos ({items.length})
            </button>
            {ALPHABET.map((letter) => {
              const count = groupCounts[letter] || 0;
              const isSelected = selectedGroup === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setSelectedGroup(letter)}
                  className={isSelected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                  style={{
                    minWidth: 36,
                    height: 34,
                    padding: "0 8px",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: isSelected ? 800 : count > 0 ? 700 : 500,
                    fontSize: "0.8rem",
                    flexShrink: 0,
                    opacity: count > 0 || isSelected ? 1 : 0.45,
                    border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  }}
                  title={`Grupo ${letter} (${count} prendas)`}
                >
                  {letter}
                  {count > 0 && (
                    <span style={{ fontSize: "0.65rem", marginLeft: 3, opacity: 0.8 }}>
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
              : searchMode === "group"
              ? `No hay prendas registradas en el Grupo "${selectedGroup}". Prueba seleccionando otra letra.`
              : "Prueba cambiando de término o limpiando la barra de búsqueda."}
          </p>
          {items.length === 0 ? (
            <button onClick={handleNew} className="btn btn-primary">
              + Agregar primera prenda
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedGroup("all");
                setSelectedCategory("all");
              }}
              className="btn btn-secondary btn-sm"
            >
              Restablecer filtros
            </button>
          )}
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
                {/* Vertical 9:16 Image Container (Interactive Lightbox Trigger) */}
                <div
                  onClick={() => {
                    if (hasImage) {
                      setLightboxImage({
                        src: item.images[0],
                        name: item.name,
                        category: item.category,
                        section: item.section,
                        price_cents: item.price_cents,
                      });
                    }
                  }}
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
                    cursor: hasImage ? "zoom-in" : "default",
                  }}
                  title={hasImage ? "🔍 Clic para ampliar imagen" : undefined}
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
                      zIndex: 2,
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
                      zIndex: 2,
                    }}
                  >
                    {item.category || "Bodas & Matrimonios"}
                  </div>

                  {/* Ampliar Badge */}
                  {hasImage && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.8)",
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: "0.6875rem",
                        color: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        zIndex: 2,
                        backdropFilter: "blur(2px)",
                      }}
                    >
                      <span>🔍</span>
                      <span>Ampliar</span>
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

      {/* Modal Crear / Editar */}
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

      {/* Lightbox / Visor de Imagen Ampliada */}
      {lightboxImage && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxImage(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            animation: "fadeIn 0.2s ease",
          }}
        >
          {/* Top Bar with Close Button */}
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              zIndex: 10001,
            }}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="btn btn-secondary btn-sm"
              style={{
                background: "rgba(0, 0, 0, 0.65)",
                borderColor: "rgba(255, 255, 255, 0.25)",
                color: "#FFFFFF",
                fontSize: "1.2rem",
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
              }}
              title="Cerrar (Escape)"
            >
              ✕
            </button>
          </div>

          {/* Centered Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              maxWidth: "92vw",
              maxHeight: "88vh",
              position: "relative",
            }}
          >
            <img
              src={lightboxImage.src}
              alt={lightboxImage.name}
              style={{
                maxWidth: "100%",
                maxHeight: "74vh",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: "var(--radius-lg)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
                border: "1px solid var(--color-border)",
              }}
            />

            {/* Info Subtitle Bar */}
            <div
              style={{
                marginTop: 14,
                background: "rgba(18, 18, 18, 0.94)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                width: "100%",
                maxWidth: 560,
                boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      background: "rgba(200, 164, 92, 0.15)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                      borderRadius: "var(--radius-full)",
                      padding: "2px 8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    Grupo {formatGroupLetter(lightboxImage.section)}
                  </span>
                  <strong style={{ fontSize: "1rem", color: "#FFFFFF" }}>
                    {lightboxImage.name}
                  </strong>
                </div>
                <p style={{ margin: "3px 0 0 0", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                  {lightboxImage.category || "Bodas & Matrimonios"}
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", display: "block" }}>
                  Precio admin
                </span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  S/ {(lightboxImage.price_cents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
