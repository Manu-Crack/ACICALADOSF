"use client";

import Link from "next/link";
import { useCart, CartService } from "@/components/cart/CartProvider";

export function ServiceCard({
  service,
}: {
  service: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    type: string;
    price_cents: number;
    duration_minutes: number;
    images: string[];
  };
}) {
  const { addToCart, removeFromCart, isInCart } = useCart();
  const priceFormatted = (service.price_cents / 100).toFixed(2);
  const inCart = isInCart(service.id);

  function handleCartToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const cartItem: CartService = {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      type: service.type as "barberia" | "spa",
      price_cents: service.price_cents,
      duration_minutes: service.duration_minutes,
      images: service.images,
    };
    if (inCart) {
      removeFromCart(service.id);
    } else {
      addToCart(cartItem);
    }
  }

  return (
    <div className="card card-gold" style={{ display: "flex", flexDirection: "column" }}>
      {/* Image or placeholder */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16/10",
          borderRadius: "var(--radius-md)",
          marginBottom: 16,
          overflow: "hidden",
          background:
            service.images.length > 0
              ? `url(${service.images[0]}) center/cover`
              : "linear-gradient(135deg, var(--color-bg), rgba(200,164,92,0.1))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {service.images.length === 0 && (
          <img
            src={service.type === "barberia" ? "/LogoBarberia.svg" : "/LogoSpa.svg"}
            alt={service.type === "barberia" ? "Barbería" : "Spa"}
            style={{ width: 48, height: "auto", opacity: 0.4 }}
          />
        )}
      </div>

      <h4 className="heading-sm" style={{ marginBottom: 8 }}>
        {service.name}
      </h4>
      {service.description && (
        <p
          className="text-muted"
          style={{
            fontSize: "0.875rem",
            marginBottom: 16,
            flex: 1,
            lineHeight: 1.6,
          }}
        >
          {service.description}
        </p>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--color-primary)",
          }}
        >
          S/ {priceFormatted}
        </span>
        <span className="badge badge-neutral">
          ⏱️ {service.duration_minutes} min
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <Link
          href={`/reservar?type=${service.type}`}
          className="btn btn-primary btn-sm"
          style={{ flex: 1, textAlign: "center" }}
        >
          Reservar
        </Link>
        <button
          onClick={handleCartToggle}
          className={`btn btn-sm ${inCart ? "btn-primary" : "btn-secondary"}`}
          style={{
            flex: 1,
            transition: "all var(--transition-fast)",
          }}
        >
          {inCart ? "✓ En carrito" : "🛒 Agregar"}
        </button>
      </div>
    </div>
  );
}
