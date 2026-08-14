"use client";

import { useState, useMemo } from "react";

export type PublicWardrobeItem = {
  id: string;
  name: string;
  description: string | null;
  section: string;
  category?: string | null;
  images: string[];
  availability_status?: string;
};

export const EVENT_CATEGORIES = [
  "Bodas & Matrimonios",
  "Quinceañeras",
  "Gala & Noche",
  "Trajes Típicos & Costumbristas",
  "Casual & Sesiones de Fotos",
] as const;

function formatGroupLetter(section?: string | null): string {
  if (!section) return "A";
  return section.replace(/^(grupo|categor[ií]a)\s*:?\s*/i, "").trim() || section;
}

export function WardrobeClientGallery({
  items,
  whatsappNumber = "51997766828",
}: {
  items: PublicWardrobeItem[];
  whatsappNumber?: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter items by category and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemCategory = item.category || "Bodas & Matrimonios";
      const matchesCategory =
        selectedCategory === "all" || itemCategory === selectedCategory;

      const query = searchQuery.trim().toLowerCase();
      const groupLetter = formatGroupLetter(item.section).toLowerCase();

      const matchesSearch =
        query === "" ||
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        groupLetter === query ||
        (item.section && item.section.toLowerCase().includes(query)) ||
        itemCategory.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Clean WhatsApp number
  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, "") || "51997766828";

  return (
    <div>
      {/* Category / Search Navigation Bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          marginBottom: 36,
        }}
      >
        {/* Search Input for Public Gallery */}
        <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.95rem",
              color: "var(--color-text-muted)",
            }}
          >
            🔍
          </span>
          <input
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por prenda, letra (A, B, C...) o estilo..."
            style={{
              paddingLeft: 38,
              height: 46,
              borderRadius: "var(--radius-full)",
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-primary-border)",
            }}
          />
          {searchQuery && (
            <button
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
                padding: 4,
              }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>

        {/* 5 Event Category Filter Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
            padding: "4px 0",
            maxWidth: 960,
          }}
        >
          <button
            onClick={() => setSelectedCategory("all")}
            className={selectedCategory === "all" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
            style={{
              borderRadius: "var(--radius-full)",
              padding: "9px 20px",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            Todos ({items.length})
          </button>
          {EVENT_CATEGORIES.map((catName) => {
            const count = items.filter(
              (i) => (i.category || "Bodas & Matrimonios") === catName
            ).length;
            const isSelected = selectedCategory === catName;
            return (
              <button
                key={catName}
                onClick={() => setSelectedCategory(catName)}
                className={isSelected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                style={{
                  borderRadius: "var(--radius-full)",
                  padding: "9px 20px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                {catName} {count > 0 ? `(${count})` : "(0)"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Public Gallery Grid */}
      {filteredItems.length === 0 ? (
        <div
          className="card card-gold"
          style={{
            textAlign: "center",
            padding: "60px 24px",
            maxWidth: 540,
            margin: "0 auto",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>👔</div>
          <h3 className="heading-sm" style={{ marginBottom: 8 }}>
            No hay prendas disponibles en esta categoría
          </h3>
          <p className="text-muted" style={{ marginBottom: 20, fontSize: "0.9rem" }}>
            Contáctanos directamente por WhatsApp para consultar sobre diseños y confecciones personalizadas.
          </p>
          <a
            href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              "¡Hola Acicalados! Quisiera consultar sobre las prendas de vestuario disponibles."
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <img src="/icons/whatsApp.svg" alt="WhatsApp" style={{ width: 18, height: 18, objectFit: "contain" }} />
            <span>Consultar por WhatsApp</span>
          </a>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 28,
          }}
        >
          {filteredItems.map((item) => {
            const hasImage = item.images && item.images.length > 0;
            const imageUrl = hasImage ? item.images[0] : null;
            const groupLetter = formatGroupLetter(item.section);
            const itemCategory = item.category || "Bodas & Matrimonios";

            // WhatsApp consultation message
            const whatsappMessage = `¡Hola Acicalados! 👋 Estoy interesado/a en la prenda "${item.name}" (Código: ${groupLetter}, Categoría: ${itemCategory}) que vi en su catálogo web. ¿Podrían brindarme mayor información sobre disponibilidad y tallas?`;
            const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

            return (
              <div
                key={item.id}
                className="card card-gold"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: 20,
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-primary-border)",
                  transition: "all var(--transition-normal)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* 1. Imagen (Formato Vertical 1080 x 1920 / 9:16) */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "9/14", // Proporción vertical estilizada y adaptativa
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    marginBottom: 16,
                    background: "radial-gradient(circle at center, rgba(200,164,92,0.1) 0%, rgba(15,15,15,0.95) 100%)",
                    border: "1px solid rgba(200,164,92,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.4s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.04)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <span style={{ fontSize: "3.5rem", opacity: 0.3 }}>👔</span>
                      <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 8 }}>
                        Exclusivo en salón
                      </p>
                    </div>
                  )}

                  {/* 4. Grupo (Badge flotante sobre la imagen con solo la letra del abecedario) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "rgba(10, 10, 10, 0.9)",
                      backdropFilter: "blur(6px)",
                      border: "1.5px solid var(--color-primary)",
                      color: "var(--color-primary)",
                      minWidth: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 10px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.875rem",
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
                    }}
                    title={`Código / Grupo ${groupLetter}`}
                  >
                    {groupLetter}
                  </div>

                  {/* 5. Badge Categoría de Evento */}
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "rgba(10, 10, 10, 0.85)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(200,164,92,0.3)",
                      color: "var(--color-text)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                    }}
                  >
                    {itemCategory}
                  </div>
                </div>

                {/* 2. Título */}
                <h3
                  className="heading-sm"
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    marginBottom: 8,
                    color: "var(--color-text)",
                    lineHeight: 1.3,
                  }}
                >
                  {item.name}
                </h3>

                {/* 3. Descripción */}
                {item.description ? (
                  <p
                    className="text-muted"
                    style={{
                      fontSize: "0.875rem",
                      lineHeight: 1.6,
                      marginBottom: 20,
                      flex: 1,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.description}
                  </p>
                ) : (
                  <p
                    className="text-muted"
                    style={{
                      fontSize: "0.875rem",
                      fontStyle: "italic",
                      marginBottom: 20,
                      flex: 1,
                    }}
                  >
                    Confección de alta costura y acabados premium.
                  </p>
                )}

                {/* 5. Botón de WhatsApp para Consultar (SIN MOSTRAR PRECIO) */}
                <div style={{ marginTop: "auto", paddingTop: 8 }}>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      fontWeight: 600,
                      padding: "12px 16px",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <img
                      src="/icons/whatsApp.svg"
                      alt="WhatsApp"
                      style={{ width: 20, height: 20, objectFit: "contain" }}
                    />
                    <span>Consultar por WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
