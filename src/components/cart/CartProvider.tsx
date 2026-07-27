"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { CartDrawer } from "./CartDrawer";

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

  // Cart Drawer open/close states
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = "acicalados_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartService[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((prev) => !prev), []);

  const addToCart = useCallback((service: CartService) => {
    setCart((prev) => {
      if (prev.find((s) => s.id === service.id)) return prev;
      return [...prev, service];
    });
    setIsCartOpen(true); // Abrir el carrito automáticamente al agregar un ítem
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const toggleCartItem = useCallback((service: CartService) => {
    setCart((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        setIsCartOpen(true);
        return [...prev, service];
      }
    });
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
        isCartOpen,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
      <CartDrawer />
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
