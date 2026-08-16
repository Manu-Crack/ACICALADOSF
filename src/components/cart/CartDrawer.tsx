"use client";

import { useCart } from "./CartProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/utils/format";

export function CartDrawer() {
  const {
    cart,
    removeFromCart,
    clearCart,
    isCartOpen,
    closeCart,
    cartCount,
    totalCents,
    totalDuration,
  } = useCart();

  const router = useRouter();

  if (!isCartOpen) return null;

  function handleCheckout() {
    closeCart();
    router.push("/reservar");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(6px)",
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Drawer Panel */}
      <div
        className="card-gold"
        style={{
          position: "relative",
          zIndex: 2001,
          width: "100%",
          maxWidth: 420,
          height: "100%",
          background: "rgba(18, 15, 10, 0.98)",
          borderLeft: "1px solid var(--color-primary-border)",
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.8)",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          borderRadius: 0,
          animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(200, 164, 92, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.25rem" }}>🛒</span>
            <div>
              <h2
                className="text-gold"
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 800,
                  margin: 0,
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                Carrito de Compras
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                }}
              >
                {cartCount === 1 ? "1 elemento seleccionado" : `${cartCount} elementos seleccionados`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="btn btn-ghost btn-sm"
            style={{
              padding: "4px 8px",
              fontSize: "1.25rem",
              color: "var(--color-text-muted)",
            }}
            title="Cerrar carrito"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {cartCount === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "40px 16px",
              }}
            >
              <div
                style={{
                  fontSize: "3.5rem",
                  marginBottom: 16,
                  filter: "drop-shadow(0 4px 12px rgba(200,164,92,0.2))",
                }}
              >
                🛒✨
              </div>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: 8,
                  color: "#FFFFFF",
                }}
              >
                Tu carrito está vacío
              </h3>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: 24,
                  lineHeight: 1.5,
                  maxWidth: 280,
                }}
              >
                Explora nuestros servicios de Barbería y Spa para agregar citas a tu carrito.
              </p>
              <Link
                href="/servicios"
                onClick={closeCart}
                className="btn btn-primary"
                style={{ width: "100%", maxWidth: 240 }}
              >
                Ver Servicios disponibles
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 14,
                    background: "rgba(28, 25, 18, 0.8)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span
                        className="badge badge-gold"
                        style={{ fontSize: "0.625rem", padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        {item.type === "barberia" ? (
                          "💈 Barbería"
                        ) : (
                          <>
                            <img src="/LogoSpa.svg" alt="Spa" style={{ width: 12, height: 12, display: "inline-block" }} /> Spa
                          </>
                        )}
                      </span>
                    </div>
                    <h4
                      style={{
                        fontWeight: 700,
                        fontSize: "0.9375rem",
                        color: "#FFFFFF",
                        marginBottom: 2,
                      }}
                    >
                      {item.name}
                    </h4>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-primary-light)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <img src="/Reloj.svg" alt="Duración" style={{ width: 13, height: 13, display: "inline-block" }} /> {formatDuration(item.duration_minutes)}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "var(--color-primary)",
                        fontSize: "1rem",
                      }}
                    >
                      S/ {(item.price_cents / 100).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      style={{
                        background: "rgba(184, 59, 46, 0.15)",
                        border: "1px solid rgba(184, 59, 46, 0.3)",
                        color: "#ef4444",
                        borderRadius: 4,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontSize: "0.8125rem",
                        transition: "all var(--transition-fast)",
                      }}
                      title="Eliminar del carrito"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={clearCart}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-text-dim)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Vaciar todo el carrito
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {cartCount > 0 && (
          <div
            style={{
              padding: 24,
              borderTop: "1px solid var(--color-border)",
              background: "rgba(20, 18, 12, 0.95)",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8125rem",
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: 6,
                }}
              >
                <span>Duración estimada total:</span>
                <span style={{ fontWeight: 600, color: "var(--color-primary-light)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <img src="/Reloj.svg" alt="Duración" style={{ width: 14, height: 14, display: "inline-block" }} /> {formatDuration(totalDuration)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1.125rem",
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                <span>Monto acumulado:</span>
                <span style={{ color: "var(--color-primary)" }}>
                  S/ {(totalCents / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              className="btn btn-primary btn-lg"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              🔒 Proceder a Reservar / Pago
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideLeft {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
