"use client";

import { useCart } from "./CartProvider";

export function CartButton() {
  const { cartCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className="group inline-flex items-center justify-center h-9 sm:h-[38px] px-3 py-1.5 rounded-full hover:bg-[#C8A45C]/15 text-gray-200 hover:text-[#C8A45C] transition-all duration-200 text-sm font-medium cursor-pointer shrink-0 gap-2.5"
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

      <span className="tracking-wide select-none leading-none">Carrito</span>

      {/* Circular Gold Badge with Black Text */}
      {cartCount > 0 && (
        <span className="w-5 h-5 min-w-[20px] rounded-full bg-[#C8A45C] text-black font-extrabold text-xs flex items-center justify-center shrink-0 shadow-inner leading-none ml-0.5">
          {cartCount}
        </span>
      )}
    </button>
  );
}
