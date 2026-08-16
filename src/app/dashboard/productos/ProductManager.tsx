"use client";

import { useState } from "react";
import { ProductFormModal, ProductItem } from "./ProductFormModal";

interface ProductManagerProps {
  initialProducts: ProductItem[];
}

export function ProductManager({ initialProducts }: ProductManagerProps) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [modalProduct, setModalProduct] = useState<ProductItem | null | undefined>(undefined);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<ProductItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const reloadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Error al recargar productos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (product: ProductItem) => {
    try {
      setActionError("");
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          is_active: !product.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cambiar estado");
      }

      const updated = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar";
      setActionError(msg);
    }
  };

  const handleDelete = async (product: ProductItem) => {
    try {
      setDeleting(true);
      setActionError("");
      const res = await fetch(`/api/admin/products?id=${product.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar el producto");
      }

      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setDeleteConfirmProduct(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar";
      setActionError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Categories list
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[];

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && product.is_active) ||
      (statusFilter === "inactive" && !product.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header y Acciones */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="heading-lg" style={{ margin: 0 }}>
            Gestión de <span className="text-gold">Productos</span>
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 4 }}>
            Administra los precios internos, stock y beneficios en viñetas para el catálogo de Acicalados.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalProduct(null)}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <span>🛍️</span>
          <span>Nuevo Producto</span>
        </button>
      </div>

      {actionError && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(184, 59, 46, 0.15)",
            border: "1px solid rgba(184, 59, 46, 0.3)",
            borderRadius: "var(--radius-md)",
            color: "#ff6b6b",
            fontSize: "0.875rem",
          }}
        >
          ⚠️ {actionError}
        </div>
      )}

      {/* Buscador y Filtros */}
      <div
        className="card"
        style={{
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flex: 1, minWidth: "240px", gap: 12 }}>
          <input
            type="text"
            className="input"
            placeholder="🔍 Buscar por nombre, categoría o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: "8px 14px", fontSize: "0.875rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "8px 32px 8px 12px", fontSize: "0.875rem", width: "auto", minWidth: "160px" }}
          >
            <option value="all">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 32px 8px 12px", fontSize: "0.875rem", width: "auto", minWidth: "140px" }}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla de Productos (Data Table con Precio y Stock Obligatorio) */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  background: "rgba(20, 18, 12, 0.6)",
                  color: "var(--color-primary)",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <th style={{ padding: "14px 16px" }}>Producto</th>
                <th style={{ padding: "14px 16px" }}>Categoría</th>
                <th style={{ padding: "14px 16px" }}>Precio Interno</th>
                <th style={{ padding: "14px 16px" }}>Stock</th>
                <th style={{ padding: "14px 16px" }}>Beneficios</th>
                <th style={{ padding: "14px 16px" }}>Estado</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const priceFormatted = (product.price_cents / 100).toFixed(2);
                  const featureCount = product.features?.length || 0;

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: "1px solid rgba(200, 164, 92, 0.08)",
                        transition: "background var(--transition-fast)",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(200, 164, 92, 0.04)")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Portada & Nombre */}
                      <td style={{ padding: "14px 16px", maxWidth: "300px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: "var(--radius-sm)",
                              overflow: "hidden",
                              background: "rgba(0,0,0,0.5)",
                              border: "1px solid var(--color-border)",
                              flexShrink: 0,
                            }}
                          >
                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "1.2rem",
                                }}
                              >
                                🛍️
                              </div>
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontWeight: 600,
                                color: "var(--color-text)",
                                margin: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={product.name}
                            >
                              {product.name}
                            </p>
                            <p
                              className="text-muted"
                              style={{
                                fontSize: "0.75rem",
                                margin: "2px 0 0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {product.description || "Sin descripción"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          className="badge badge-gold"
                          style={{ fontSize: "0.6875rem", whiteSpace: "nowrap" }}
                        >
                          {product.category || "General"}
                        </span>
                      </td>

                      {/* Precio Interno (S/) */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", fontWeight: 700, color: "var(--color-primary)" }}>
                        S/ {priceFormatted}
                      </td>

                      {/* Stock */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span
                          className={`badge ${
                            product.stock > 10
                              ? "badge-success"
                              : product.stock > 0
                              ? "badge-warning"
                              : "badge-error"
                          }`}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {product.stock} unids.
                        </span>
                      </td>

                      {/* Beneficios */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap", color: "var(--color-paper)" }}>
                        ✦ {featureCount} {featureCount === 1 ? "viñeta" : "viñetas"}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: "14px 16px" }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className={`badge ${product.is_active ? "badge-success" : "badge-neutral"}`}
                          style={{
                            cursor: "pointer",
                            border: "none",
                            padding: "4px 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                          title="Clic para alternar visibilidad pública"
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: product.is_active ? "#6A994E" : "#888",
                            }}
                          />
                          {product.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          {/* Editar */}
                          <button
                            type="button"
                            onClick={() => setModalProduct(product)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "4px 10px", fontSize: "0.8125rem" }}
                            title="Editar producto"
                          >
                            ✏️ Editar
                          </button>

                          {/* Eliminar */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmProduct(product)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: "4px 8px", color: "#ff6b6b" }}
                            title="Eliminar producto"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "48px 16px", color: "var(--color-text-muted)" }}>
                    <span style={{ fontSize: "2rem", display: "block", marginBottom: 8 }}>🛍️</span>
                    {products.length === 0 ? (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "1rem", color: "var(--color-text)" }}>
                          Aún no has registrado productos en el catálogo.
                        </p>
                        <p style={{ fontSize: "0.875rem", marginTop: 4 }}>
                          Haz clic en &quot;Nuevo Producto&quot; para agregar tu primer producto con sus beneficios en viñetas.
                        </p>
                      </div>
                    ) : (
                      <p>No se encontraron productos con los filtros aplicados.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario (Crear / Editar) */}
      {modalProduct !== undefined && (
        <ProductFormModal
          product={modalProduct}
          onClose={() => setModalProduct(undefined)}
          onSave={() => {
            setModalProduct(undefined);
            reloadProducts();
          }}
        />
      )}

      {/* Modal Confirmación de Eliminación */}
      {deleteConfirmProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card card-gold animate-fadeIn"
            style={{
              maxWidth: 440,
              width: "100%",
              textAlign: "center",
              padding: 28,
              background: "rgba(20, 16, 12, 0.95)",
            }}
          >
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}>⚠️</span>
            <h3 className="heading-md" style={{ marginBottom: 8 }}>
              ¿Eliminar este producto?
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 24, lineHeight: 1.5 }}>
              Estás a punto de eliminar &ldquo;<strong style={{ color: "var(--color-text)" }}>{deleteConfirmProduct.name}</strong>&rdquo;. Esta acción borrará el registro y sus fotos de Storage de forma permanente.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="btn btn-ghost"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmProduct)}
                className="btn btn-sm"
                style={{
                  background: "#B83B2E",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
