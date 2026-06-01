"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartButton() {
  const { cartCount, totalCents } = useCart();

  if (cartCount === 0) return null;

  return (
    <Link
      href="/reservar"
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: "var(--radius-md)",
        background: "rgba(200,164,92,0.10)",
        border: "1px solid rgba(200,164,92,0.25)",
        color: "var(--color-primary)",
        fontSize: "0.875rem",
        fontWeight: 600,
        fontFamily: "'Playfair Display', Georgia, serif",
        textDecoration: "none",
        transition: "all var(--transition-fast)",
      }}
    >
      🛒
      <span style={{
        position: "absolute",
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "var(--color-primary)",
        color: "var(--color-bg)",
        fontSize: "0.6875rem",
        fontWeight: 700,
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {cartCount}
      </span>
      <span style={{ fontSize: "0.75rem", fontFamily: "'DM Sans', sans-serif" }}>
        S/ {(totalCents / 100).toFixed(2)}
      </span>
    </Link>
  );
}
