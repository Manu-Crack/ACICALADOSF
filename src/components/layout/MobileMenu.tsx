"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

type MobileMenuProps = {
  user: boolean;
  profileName?: string | null;
  isInternal: boolean;
  onSignOut: () => Promise<void>;
};

interface NavLinkItem {
  label: string;
  href: string;
  icon?: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Vestuario", href: "/vestuario" },
  { label: "Productos", href: "/tienda" },
  { label: "Blog", href: "/blog" },
  { label: "Ubicación", href: "/ubicacion" },
];

const SEARCH_SUGGESTIONS = [
  { title: "Corte de Cabello", href: "/servicios" },
  { title: "Perfilado de Barba", href: "/servicios" },
  { title: "Alquiler de Trajes", href: "/vestuario" },
  { title: "Productos de Cuidado", href: "/tienda" },
];

export function MobileMenu({
  user,
  profileName,
  isInternal,
  onSignOut,
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const { cartCount, openCart } = useCart();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setSearchQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const q = searchQuery.toLowerCase().trim();
    setIsOpen(false);

    if (q.includes("traje") || q.includes("vestuario") || q.includes("terna")) {
      router.push("/vestuario");
    } else if (q.includes("producto") || q.includes("tienda") || q.includes("cera") || q.includes("shampoo")) {
      router.push("/tienda");
    } else if (q.includes("blog") || q.includes("articulo") || q.includes("noticia")) {
      router.push("/blog");
    } else if (q.includes("ubicacion") || q.includes("mapa") || q.includes("donde")) {
      router.push("/ubicacion");
    } else if (q.includes("reserva") || q.includes("cita") || q.includes("turno")) {
      router.push("/reservar");
    } else {
      router.push("/servicios");
    }
  };

  const displayName = profileName || (user ? "Manuel Elias" : "Usuario");

  return (
    <>
      {/* Trigger Button - 3 Golden Horizontal Lines */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1.5 sm:p-2 rounded-lg text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
        title="Abrir Menú de Navegación"
        aria-label="Abrir Menú"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C8A45C"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#C8A45C]"
        >
          <line x1="3" y1="6" x2="21" y2="6" stroke="#C8A45C" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="3" y1="12" x2="21" y2="12" stroke="#C8A45C" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="3" y1="18" x2="21" y2="18" stroke="#C8A45C" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Slide-in Drawer with Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm transition-opacity duration-300 flex justify-end"
          onClick={() => setIsOpen(false)}
        >
          {/* Drawer Container */}
          <div
            ref={drawerRef}
            className="w-full max-w-[360px] sm:max-w-[400px] h-full bg-black border-l border-[#C8A45C]/35 shadow-[-15px_0_50px_rgba(0,0,0,0.95)] flex flex-col justify-between overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* TOP SECTION (Header + Nav + Search) */}
            <div className="p-6">
              {/* 1. CABECERA (Logo & Close Button) */}
              <div className="flex items-center justify-between pb-5 border-b border-[#C8A45C]/20 mb-6">
                <Link
                  href="/"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src="/LogoAcicalados.svg"
                    alt="Logo Acicalados"
                    className="h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="flex flex-col justify-center">
                    <span
                      className="font-serif font-bold text-sm sm:text-base text-[#C8A45C] tracking-[0.2em] leading-none"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      ACICALADOS
                    </span>
                    <span
                      className="text-[8px] sm:text-[9px] text-[#C8A45C]/80 tracking-[0.26em] font-semibold leading-none mt-1"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      DISEÑO &amp; CALIDAD
                    </span>
                  </div>
                </Link>

                {/* Stylized Close Button ("X") */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-lg border border-[#C8A45C]/40 text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/15 hover:border-[#C8A45C] flex items-center justify-center transition-all duration-200 cursor-pointer text-lg font-bold"
                  aria-label="Cerrar Menú"
                  title="Cerrar Menú"
                >
                  ✕
                </button>
              </div>

              {/* 2. NAVEGACIÓN VERTICAL */}
              <nav className="flex flex-col gap-1.5 mb-6">
                <p className="text-[10px] font-bold text-[#C8A45C]/70 uppercase tracking-[0.2em] px-3 mb-1">
                  Navegación
                </p>
                {NAV_LINKS.map((link) => {
                  const isActive =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(link.href + "/");

                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-base transition-all duration-200 ${
                        isActive
                          ? "bg-[#C8A45C]/15 text-[#C8A45C] border-l-4 border-[#C8A45C] font-semibold pl-4 shadow-[inset_0_1px_0_rgba(200,164,92,0.2)]"
                          : "text-gray-300 hover:text-white hover:bg-white/5 border-l-4 border-transparent pl-4"
                      }`}
                    >
                      <span className="tracking-wide">{link.label}</span>
                      <span
                        className={`text-xs transition-transform duration-200 ${
                          isActive ? "text-[#C8A45C] translate-x-1" : "text-gray-600"
                        }`}
                      >
                        ➔
                      </span>
                    </Link>
                  );
                })}
              </nav>

              {/* 3. BUSCADOR ADAPTADO PARA MÓVIL */}
              <div className="mb-6">
                <p className="text-[10px] font-bold text-[#C8A45C]/70 uppercase tracking-[0.2em] px-3 mb-2">
                  Búsqueda Rápida
                </p>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar servicios, trajes, blog..."
                    className="w-full bg-[#141414] border border-[#C8A45C]/35 focus:border-[#C8A45C] rounded-xl py-2.5 pl-10 pr-10 text-sm text-gray-100 placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
                  />
                  <svg
                    className="w-4 h-4 text-[#C8A45C] absolute left-3.5 top-1/2 -translate-y-1/2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8A45C] hover:text-[#EBDBB2] text-xs font-semibold"
                    >
                      Ir
                    </button>
                  )}
                </form>

                {/* Quick suggestions tags */}
                <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                  {SEARCH_SUGGESTIONS.map((sug) => (
                    <Link
                      key={sug.title}
                      href={sug.href}
                      onClick={() => setIsOpen(false)}
                      className="text-[11px] bg-[#141414] hover:bg-[#C8A45C]/20 text-gray-400 hover:text-[#C8A45C] border border-[#C8A45C]/20 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      {sug.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. ACCIONES INFERIORES (Carrito + Usuario a ancho completo) */}
            <div className="p-6 bg-[#0A0A0A] border-t border-[#C8A45C]/25 flex flex-col gap-3">
              {/* Botón de Carrito a Ancho Completo */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openCart();
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#C8A45C]/60 hover:border-[#C8A45C] bg-[#141414] hover:bg-[#C8A45C]/15 text-gray-200 transition-all duration-200 text-sm font-medium shadow-sm cursor-pointer group"
                title="Abrir Carrito"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-[#C8A45C] group-hover:scale-110 transition-transform"
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
                  <span className="font-semibold text-gray-200">Ver Carrito</span>
                </div>

                {/* Circular Gold Badge with Black Count */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Items:</span>
                  <span className="w-6 h-6 rounded-full bg-[#C8A45C] text-black font-extrabold text-xs flex items-center justify-center shadow-inner">
                    {cartCount > 0 ? cartCount : 2}
                  </span>
                </div>
              </button>

              {/* Botón / Sección de Usuario a Ancho Completo */}
              {user ? (
                <div className="flex flex-col gap-2 bg-[#141414] border border-[#C8A45C]/35 rounded-xl p-3.5">
                  {/* User Profile Info */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#C8A45C]/20">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-full bg-[#C8A45C]/20 border border-[#C8A45C]/50 flex items-center justify-center text-sm text-[#C8A45C] font-bold shrink-0">
                        {displayName[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-[10px] text-gray-400 leading-tight">Usuario</span>
                        <span className="text-sm font-semibold text-[#C8A45C] truncate leading-tight mt-0.5">
                          {displayName}
                        </span>
                      </div>
                    </div>

                    {isInternal && (
                      <span className="text-[10px] bg-[#C8A45C] text-black font-bold px-2 py-0.5 rounded-full shrink-0">
                        Admin
                      </span>
                    )}
                  </div>

                  {/* User Options */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      href="/mi-cuenta"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-[#C8A45C]/15 border border-[#C8A45C]/20 text-xs font-medium text-gray-200 hover:text-white transition-colors text-center"
                    >
                      <span>👤</span> Mi Cuenta
                    </Link>

                    <Link
                      href="/reservar"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#C8A45C] hover:bg-[#EBDBB2] text-xs font-bold text-black transition-colors text-center shadow-sm"
                    >
                      <span>📅</span> Reservar
                    </Link>
                  </div>

                  {isInternal && (
                    <Link
                      href="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-[#C8A45C]/15 border border-[#C8A45C]/20 text-xs font-medium text-gray-200 hover:text-white transition-colors text-center"
                    >
                      <span>👑</span> Panel de Administración
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setIsOpen(false);
                      await onSignOut();
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <span>🚪</span> Cerrar Sesión
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="w-full py-3 px-4 rounded-xl border border-[#C8A45C]/60 hover:border-[#C8A45C] bg-[#141414] hover:bg-[#C8A45C]/15 text-gray-100 hover:text-white text-sm font-medium text-center transition-all flex items-center justify-center gap-2"
                  >
                    <span>🔑</span> Iniciar Sesión
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setIsOpen(false)}
                    className="w-full py-3 px-4 rounded-xl bg-[#C8A45C] hover:bg-[#EBDBB2] text-black text-sm font-bold text-center transition-all shadow-[0_4px_15px_rgba(200,164,92,0.25)] flex items-center justify-center gap-2"
                  >
                    <span>✨</span> Crear Cuenta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
