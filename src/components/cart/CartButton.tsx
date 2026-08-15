"use client";

import { useCart } from "./CartProvider";

export function CartButton() {
  const { cartCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className="group flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg border border-[#C8A45C]/60 hover:border-[#C8A45C] bg-black/40 hover:bg-[#C8A45C]/10 text-gray-200 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-[0_0_12px_rgba(200,164,92,0.15)] cursor-pointer shrink-0"
      title="Abrir Carrito de Compras"
      aria-label="Abrir Carrito"
    >
      {/* Shopping Cart Icon */}
      <svg
        className="w-4 h-4 text-gray-200 group-hover:text-[#C8A45C] transition-colors shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>

      <span className="tracking-wide">Carrito</span>

      {/* Circular Gold Badge with Black Text */}
      <span className="w-5 h-5 rounded-full bg-[#C8A45C] text-black font-extrabold text-xs flex items-center justify-center shadow-inner shrink-0">
        {cartCount > 0 ? cartCount : 2}
      </span>
    </button>
  );
}
