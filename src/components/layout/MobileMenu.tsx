"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type MobileMenuProps = {
  user: boolean;
  profileName?: string | null;
  isInternal: boolean;
  onSignOut: () => Promise<void>;
};

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Vestuario", href: "/vestuario" },
  { label: "Productos", href: "/tienda" },
  { label: "Blog", href: "/blog" },
  { label: "Ubicación", href: "/ubicacion" },
];

export function MobileMenu({
  user,
  profileName,
  isInternal,
  onSignOut,
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Hamburger Trigger - 3 Golden Lines */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-1.5 sm:p-2 rounded-lg text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
        title="Abrir Menú"
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

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm transition-opacity duration-300 flex justify-end"
          onClick={() => setIsOpen(false)}
        >
          {/* Drawer Sidebar */}
          <div
            className="w-[320px] max-w-[85vw] h-full bg-[#0E0E0E] border-l border-[#C8A45C]/35 p-6 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Logo */}
            <div className="flex items-center justify-between pb-5 border-b border-[#C8A45C]/20 mb-6">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5"
              >
                <img
                  src="/LogoAcicalados.svg"
                  alt="Logo Acicalados"
                  className="h-8 w-auto object-contain"
                />
                <div className="flex flex-col">
                  <span className="font-serif font-bold text-sm text-[#C8A45C] tracking-[0.18em]">
                    ACICALADOS
                  </span>
                  <span className="text-[8px] text-[#C8A45C]/75 tracking-[0.24em] font-semibold">
                    DISEÑO &amp; CALIDAD
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg border border-[#C8A45C]/30 text-gray-400 hover:text-white hover:border-[#C8A45C] flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Cerrar Menú"
              >
                ✕
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-2 mb-6">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">
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
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                      isActive
                        ? "bg-[#C8A45C]/15 text-[#C8A45C] border border-[#C8A45C]/40 font-semibold"
                        : "text-gray-300 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <span>{link.label}</span>
                    <span className="text-xs text-[#C8A45C]/60">➔</span>
                  </Link>
                );
              })}
            </nav>

            {/* Quick Action Button */}
            <div className="mb-6">
              <Link
                href="/reservar"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#C8A45C] hover:bg-[#EBDBB2] text-black font-semibold text-sm transition-all shadow-[0_4px_15px_rgba(200,164,92,0.25)]"
              >
                <span>📅</span>
                <span>Reservar Turno</span>
              </Link>
            </div>

            {/* User & Auth Footer */}
            <div className="mt-auto pt-5 border-t border-[#C8A45C]/20 flex flex-col gap-3">
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-2 py-1">
                    <div className="w-8 h-8 rounded-full bg-[#C8A45C]/20 border border-[#C8A45C]/40 flex items-center justify-center text-sm text-[#C8A45C] font-bold">
                      {(profileName || "U")[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs text-gray-400">Hola,</span>
                      <span className="text-sm font-semibold text-[#C8A45C] truncate">
                        {profileName || "Manuel Elias"}
                      </span>
                    </div>
                  </div>

                  {isInternal && (
                    <Link
                      href="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm text-gray-200 hover:text-white bg-zinc-900 border border-[#C8A45C]/20 hover:border-[#C8A45C]/50 transition-colors"
                    >
                      <span>👑</span>
                      <span>Panel de Control</span>
                    </Link>
                  )}

                  <Link
                    href="/mi-cuenta"
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm text-gray-200 hover:text-white bg-zinc-900 border border-[#C8A45C]/20 hover:border-[#C8A45C]/50 transition-colors"
                  >
                    <span>👤</span>
                    <span>Mi Cuenta</span>
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsOpen(false);
                      await onSignOut();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>Cerrar Sesión</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-2.5 px-4 rounded-xl border border-[#C8A45C]/50 text-gray-200 hover:text-white hover:bg-[#C8A45C]/10 text-sm font-medium transition-colors"
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-2.5 px-4 rounded-xl bg-zinc-900 border border-[#C8A45C]/20 text-[#C8A45C] hover:text-[#EBDBB2] text-sm font-medium transition-colors"
                  >
                    Crear Cuenta
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
