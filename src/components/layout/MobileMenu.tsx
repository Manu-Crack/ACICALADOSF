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

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Vestuario", href: "/vestuario" },
  { label: "Productos", href: "/tienda" },
  { label: "Blog", href: "/blog" },
  { label: "Ubicación", href: "/ubicacion" },
];

export function MobileMenu({ user, profileName, isInternal, onSignOut }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Lock background scroll when drawer is open
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

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Trigger Button - 3 Golden Horizontal Lines */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg text-[#C8A45C] hover:text-[#EBDBB2] hover:bg-[#C8A45C]/10 transition-colors flex items-center justify-center cursor-pointer shrink-0"
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

      {/* Slide-in Drawer with Dark Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm transition-opacity duration-300 flex justify-end"
          onClick={() => setIsOpen(false)}
        >
          {/* Minimalist Drawer Panel */}
          <div
            className="w-full max-w-[290px] sm:max-w-[320px] h-full bg-black border-l border-[#C8A45C]/35 shadow-[-15px_0_40px_rgba(0,0,0,0.95)] p-7 flex flex-col justify-between items-center text-center overflow-y-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button ("X") */}
            <div className="w-full flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-lg border border-[#C8A45C]/40 text-[#C8A45C] hover:text-[#EBDBB2] hover:border-[#C8A45C] hover:bg-[#C8A45C]/15 flex items-center justify-center transition-all duration-200 cursor-pointer text-lg font-bold"
                aria-label="Cerrar Menú"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Exclusive Centered Vertical Navigation List */}
            <nav className="flex flex-col items-center justify-center gap-6 my-auto text-center w-full">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <div key={item.label} className="w-full flex justify-center text-center">
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`text-xl sm:text-2xl font-serif tracking-wider transition-all duration-200 relative pb-1.5 inline-block text-center ${
                        isActive
                          ? "text-[#C8A45C] font-bold after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:mx-auto after:w-full after:h-[2.5px] after:bg-[#C8A45C] after:rounded-full after:shadow-[0_0_14px_rgba(200,164,92,0.9)] drop-shadow-[0_0_8px_rgba(200,164,92,0.5)]"
                          : "text-[#C8A45C]/60 hover:text-[#C8A45C] hover:drop-shadow-[0_0_6px_rgba(200,164,92,0.35)] font-medium"
                      }`}
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                    >
                      {item.label}
                    </Link>
                  </div>
                );
              })}

              {/* Cerrar Sesión / Iniciar Sesión - Centered */}
              <div className="w-full flex justify-center items-center pt-4 border-t border-[#C8A45C]/20 mt-2 text-center">
                {user ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsOpen(false);
                      await onSignOut();
                    }}
                    className="text-xl sm:text-2xl font-serif tracking-wider text-[#C8A45C]/60 hover:text-[#C8A45C] hover:drop-shadow-[0_0_6px_rgba(200,164,92,0.35)] transition-all duration-200 cursor-pointer text-center pb-1"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    Cerrar sesión
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="text-xl sm:text-2xl font-serif tracking-wider text-[#C8A45C]/60 hover:text-[#C8A45C] hover:drop-shadow-[0_0_6px_rgba(200,164,92,0.35)] transition-all duration-200 text-center pb-1"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </nav>

            {/* Bottom Subtle Brand Mark */}
            <div className="w-full pt-6 border-t border-[#C8A45C]/15 text-center">
              <span
                className="text-[10px] text-[#C8A45C]/40 tracking-[0.28em] font-semibold block"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                ACICALADOS · DISEÑO &amp; CALIDAD
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
