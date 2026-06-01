"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type CartService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "barberia" | "spa";
  price_cents: number;
  duration_minutes: number;
  images: string[];
};

type CartContextType = {
  cart: CartService[];
  addToCart: (service: CartService) => void;
  removeFromCart: (id: string) => void;
  toggleCartItem: (service: CartService) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  cartCount: number;
  totalCents: number;
  totalDuration: number;
};

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = "acicalados_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartService[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CART_KEY);
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch {
      // sessionStorage not available
    }
    setLoaded(true);
  }, []);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // sessionStorage not available
    }
  }, [cart, loaded]);

  const addToCart = useCallback((service: CartService) => {
    setCart((prev) => {
      if (prev.find((s) => s.id === service.id)) return prev;
      return [...prev, service];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleCartItem = useCallback((service: CartService) => {
    setCart((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const isInCart = useCallback(
    (id: string) => cart.some((s) => s.id === id),
    [cart]
  );

  const cartCount = cart.length;
  const totalCents = cart.reduce((sum, s) => sum + s.price_cents, 0);
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        toggleCartItem,
        clearCart,
        isInCart,
        cartCount,
        totalCents,
        totalDuration,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
