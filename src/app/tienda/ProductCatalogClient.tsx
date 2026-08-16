"use client";

import { useState } from "react";

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  images: string[];
  features: string[];
}

interface ProductCatalogClientProps {
  products: PublicProduct[];
}

export function ProductCatalogClient({ products }: ProductCatalogClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  // Categorías únicas
  const categories = [
    "Todos",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
  ];

  // Filtrar productos
  const filteredProducts =
    selectedCategory === "Todos"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {/* Selector de Categorías (Pills) */}
      {categories.length > 2 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                style={{
                  borderRadius: "var(--radius-full)",
                  padding: "6px 18px",
                  fontSize: "0.84rem",
                  fontWeight: isActive ? 700 : 500,
                  transition: "all var(--transition-fast)",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Listado de Tarjetas Horizontales */}
      {filteredProducts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {filteredProducts.map((product) => {
            const coverImg = product.images && product.images.length > 0 ? product.images[0] : null;

            return (
              <article
                key={product.id}
                className="card card-gold animate-fadeIn"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  padding: 0,
                  overflow: "hidden",
                  background: "rgba(14, 12, 8, 0.78)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  transition: "all var(--transition-normal)",
                  minHeight: "280px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-primary-border)";
                  e.currentTarget.style.boxShadow =
                    "0 14px 35px rgba(0,0,0,0.7), 0 0 15px rgba(200,164,92,0.12)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-border)";
                  e.currentTarget.style.boxShadow = "var(--shadow-card)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* MITAD IZQUIERDA: IMAGEN DEL PRODUCTO */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    minHeight: "260px",
                    height: "100%",
                    background: "rgba(18, 15, 10, 0.95)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {coverImg ? (
                    <img
                      src={coverImg}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center",
                        display: "block",
                        transition: "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        padding: 32,
                        background:
                          "radial-gradient(circle at center, rgba(200,164,92,0.08) 0%, rgba(10,10,10,0.95) 100%)",
                      }}
                    >
                      <span style={{ fontSize: "3rem", opacity: 0.7 }}>🛍️</span>
                      <span className="text-muted" style={{ fontSize: "0.8125rem" }}>
                        Foto de Producto
                      </span>
                    </div>
                  )}
                </div>

                {/* MITAD DERECHA: INFORMACIÓN DEL PRODUCTO */}
                <div
                  style={{
                    padding: "32px 36px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    background: "rgba(14, 12, 8, 0.6)",
                  }}
                >
                  {/* Categoría */}
                  {product.category && (
                    <div style={{ marginBottom: 10 }}>
                      <span
                        className="badge badge-gold"
                        style={{
                          fontSize: "0.6875rem",
                          letterSpacing: "0.08em",
                          padding: "3px 10px",
                        }}
                      >
                        {product.category}
                      </span>
                    </div>
                  )}

                  {/* Título del producto en color blanco/hueso */}
                  <h3
                    className="heading-md"
                    style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: "#FFFFFF",
                      margin: "0 0 10px",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {product.name}
                  </h3>

                  {/* Icono decorativo dorado debajo del título */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      margin: "2px 0 16px",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 1,
                        background: "linear-gradient(90deg, #C8A45C, transparent)",
                      }}
                    />
                    <span
                      style={{
                        color: "#C8A45C",
                        fontSize: "0.85rem",
                        lineHeight: 1,
                        userSelect: "none",
                      }}
                    >
                      ✦
                    </span>
                    <div
                      style={{
                        width: 32,
                        height: 1,
                        background: "linear-gradient(270deg, #C8A45C, transparent)",
                      }}
                    />
                  </div>

                  {/* Descripción corta en gris claro */}
                  {product.description && (
                    <p
                      style={{
                        fontSize: "0.9375rem",
                        lineHeight: 1.65,
                        color: "var(--color-paper-dark)",
                        marginBottom: 20,
                      }}
                    >
                      {product.description}
                    </p>
                  )}

                  {/* Lista de Beneficios (features) con viñetas doradas */}
                  {product.features && product.features.length > 0 && (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: "4px 0 0",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {product.features.map((feature, idx) => (
                        <li
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 10,
                            fontSize: "0.875rem",
                            lineHeight: 1.5,
                            color: "var(--color-text)",
                          }}
                        >
                          <span
                            style={{
                              color: "var(--color-primary)",
                              fontSize: "0.75rem",
                              lineHeight: 1,
                              flexShrink: 0,
                              transform: "translateY(-1px)",
                            }}
                          >
                            ✦
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div
          className="card card-gold animate-fadeIn"
          style={{
            textAlign: "center",
            padding: "80px 24px",
            maxWidth: 600,
            margin: "0 auto",
            background: "rgba(14, 12, 8, 0.8)",
          }}
        >
          <span style={{ fontSize: "3rem", display: "block", marginBottom: 16 }}>🛍️</span>
          <h3 className="heading-md" style={{ marginBottom: 8, color: "var(--color-primary)" }}>
            Pronto añadiremos nuevos productos al catálogo
          </h3>
          <p className="text-muted" style={{ marginBottom: 28, lineHeight: 1.6 }}>
            Estamos preparando nuestra selección de cosmética capilar, afeitado y cuidado facial exclusivo.
          </p>
        </div>
      )}
    </div>
  );
}
