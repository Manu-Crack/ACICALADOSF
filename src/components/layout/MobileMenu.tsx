"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type MobileMenuProps = {
  user: boolean;
  profileName?: string | null;
  isInternal: boolean;
  onSignOut: () => Promise<void>;
};

export function MobileMenu({ user, profileName, isInternal, onSignOut }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on navigation or resizing above mobile width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent scroll when menu is open
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

  const navLinks = [
    { label: "Inicio", href: "/#inicio" },
    { label: "Servicios", href: "/servicios" },
    { label: "Vestuarios", href: "/vestuario" },
    { label: "Tienda", href: "/tienda" },
    { label: "Blog", href: "/blog" },
    { label: "Ubicación", href: "/ubicacion" },
  ];

  return (
    <>
      {/* Mobile Menu Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="mobile-menu-trigger"
        aria-label="Abrir menú"
        style={{ display: "flex" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-menu-overlay ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      >
        {/* Mobile Drawer */}
        <div
          className="mobile-menu-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 32,
              borderBottom: "1px solid var(--color-border)",
              paddingBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img
                src="/LogoAcicalados.svg"
                alt="Logo Acicalados"
                style={{ height: 24, width: "auto" }}
              />
              <span
                className="text-gold"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontWeight: 800,
                  fontSize: "1.125rem",
                  letterSpacing: "0.08em",
                }}
              >
                ACICALADOS
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-muted)",
                fontSize: "1.5rem",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body - Navigation Links */}
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 32,
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setIsOpen(false)}
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid transparent",
                  transition: "all var(--transition-fast)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                className="btn-ghost"
              >
                <span>{link.label}</span>
                <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>➔</span>
              </Link>
            ))}
          </nav>

          {/* Drawer Footer - Auth / Actions */}
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid var(--color-border)",
              paddingTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {user ? (
              <>
                {isInternal && (
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="btn btn-ghost"
                    style={{ width: "100%", fontSize: "0.9375rem" }}
                  >
                    Panel de Control
                  </Link>
                )}
                <Link
                  href="/mi-cuenta"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                  style={{ width: "100%", fontSize: "0.9375rem", textAlign: "center" }}
                >
                  <img
                    src="/IconUser.svg"
                    alt="User"
                    style={{ width: "35px", height: "35px" }}
                  />
                  <span>{profileName || "Mi Cuenta"}</span>
                </Link>
                <button
                  onClick={async () => {
                    setIsOpen(false);
                    await onSignOut();
                  }}
                  className="btn btn-ghost"
                  style={{
                    width: "100%",
                    fontSize: "0.9375rem",
                    color: "var(--color-error)",
                  }}
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setIsOpen(false)}
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  fontSize: "0.9375rem",
                  textAlign: "center",
                  borderColor: "var(--color-primary-border)",
                }}
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
