"use client";

import { useCart } from "./CartProvider";

export function CartButton() {
  const { cartCount, totalCents, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(200,164,92,0.12)",
        border: "1px solid var(--color-primary-border)",
        color: "var(--color-primary)",
        fontSize: "0.875rem",
        fontWeight: 600,
        fontFamily: "'Playfair Display', Georgia, serif",
        cursor: "pointer",
        transition: "all var(--transition-fast)",
      }}
      title="Abrir Carrito de Compras"
    >
      <span style={{ fontSize: "1rem" }}>🛒</span>
      {cartCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 20,
            height: 20,
            padding: "0 4px",
            borderRadius: 10,
            background: "var(--color-primary)",
            color: "var(--color-bg)",
            fontSize: "0.6875rem",
            fontWeight: 800,
            fontFamily: "'DM Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          {cartCount}
        </span>
      )}
      <span style={{ fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>
        {cartCount > 0 ? `S/ ${(totalCents / 100).toFixed(2)}` : "Carrito"}
      </span>
    </button>
  );
}
