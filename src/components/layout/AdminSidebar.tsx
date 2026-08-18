"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  first_name?: string;
  last_name?: string;
  role: string;
};

type AdminSidebarProps = {
  profile: Profile;
  userName?: string;
};

export function AdminSidebar({ profile, userName }: AdminSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();

  // Resolve user display name with fallbacks
  const displayName =
    userName ||
    (profile?.first_name || profile?.last_name
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
      : "Administrador");

  // Close drawer on path change or resize above 768px
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setIsLoggingOut(false);
    }
  };

  const isAdmin = profile.role === "admin";
  const isAdminOrRecep = ["admin", "recepcionista"].includes(profile.role);

  // Exclusive Official Sections
  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: "/iconsAdmi/Inicio.svg", show: true },
    { href: "/dashboard/reservas", label: "Reservas", icon: "/iconsAdmi/Reservas.svg", show: isAdminOrRecep },
    { href: "/dashboard/empleados", label: "Empleados", icon: "/iconsAdmi/Empleados.svg", show: isAdmin },
    { href: "/dashboard/asistencia", label: "Asistencia", icon: "/iconsAdmi/Asistencia.svg", show: isAdminOrRecep },
    { href: "/dashboard/servicios", label: "Servicios", icon: "/iconsAdmi/Servicios.svg", show: isAdmin },
    { href: "/dashboard/vestuario", label: "Vestuario", icon: "/iconsAdmi/Vestuario.svg", show: isAdminOrRecep },
    { href: "/dashboard/productos", label: "Productos", icon: "/iconsAdmi/Productos.svg", show: isAdmin },
    { href: "/dashboard/blog", label: "Blog", icon: "/iconsAdmi/Blog.svg", show: isAdmin },
  ];

  const filteredNav = navItems.filter((item) => item.show);

  const sidebarContent = (
    <>
      {/* Brand Header */}
      <div style={{ padding: "0 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
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
          </Link>
          <p
            className="text-muted"
            style={{ fontSize: "0.75rem", marginTop: 4 }}
          >
            Panel de Gestión
          </p>
        </div>
        {/* Mobile close button inside sidebar */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="admin-mobile-close-btn"
          style={{
            background: "transparent",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-text-muted)",
            fontSize: "1.1rem",
            padding: "4px 8px",
            cursor: "pointer",
          }}
          aria-label="Cerrar panel"
        >
          ✕
        </button>
      </div>

      {/* Nav List */}
      <nav style={{ flex: 1, padding: "0 12px", overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                  background: isActive ? "var(--color-primary-glow)" : "transparent",
                  border: isActive ? "1px solid var(--color-primary-border)" : "1px solid transparent",
                  transition: "all var(--transition-fast)",
                  textDecoration: "none",
                }}
              >
                <img
                  src={item.icon}
                  alt={item.label}
                  style={{
                    width: 20,
                    height: 20,
                    objectFit: "contain",
                    opacity: isActive ? 1 : 0.75,
                    filter: isActive ? "brightness(1.15)" : "none",
                    transition: "all var(--transition-fast)",
                  }}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Section: User Info & Logout Button */}
      <div
        style={{
          padding: "16px 16px",
          borderTop: "1px solid var(--color-border)",
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "rgba(0, 0, 0, 0.2)",
        }}
      >
        {/* User Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 4px",
          }}
        >
          {/* Generic User SVG Icon (No img avatar, keeping Premium Black/Gold theme) */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-full)",
              background: "rgba(200, 164, 92, 0.12)",
              border: "1px solid rgba(200, 164, 92, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-primary)",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "var(--color-text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: 0,
              }}
              title={displayName}
            >
              {displayName}
            </p>
            <p
              className="badge badge-gold"
              style={{
                marginTop: 4,
                fontSize: "0.6875rem",
                textTransform: "capitalize",
                display: "inline-block",
              }}
            >
              {profile.role || "Admin"}
            </p>
          </div>
        </div>

        {/* Visual Separator */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(200, 164, 92, 0.25), transparent)",
            width: "100%",
          }}
        />

        {/* Cerrar Sesión Button */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="admin-logout-btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "#f87171",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.22)",
            cursor: isLoggingOut ? "not-allowed" : "pointer",
            transition: "all var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.18)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
              e.currentTarget.style.color = "#fca5a5";
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoggingOut) {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.22)";
              e.currentTarget.style.color = "#f87171";
            }
          }}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          {isLoggingOut ? (
            <svg
              className="animate-spin"
              style={{ width: 16, height: 16, flexShrink: 0 }}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                style={{ opacity: 0.25 }}
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                style={{ opacity: 0.75 }}
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          )}
          <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Top Mobile Bar for Dashboard */}
      <header className="dashboard-mobile-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/LogoAcicalados.svg"
            alt="Logo Acicalados"
            style={{ height: 22, width: "auto" }}
          />
          <span
            className="text-gold"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 800,
              fontSize: "1rem",
              letterSpacing: "0.06em",
            }}
          >
            PANEL
          </span>
        </div>

        <button
          onClick={() => setIsMobileOpen(true)}
          className="mobile-menu-trigger"
          aria-label="Abrir menú de gestión"
          style={{ display: "inline-flex" }}
        >
          <svg
            width="22"
            height="22"
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
      </header>

      {/* Desktop Fixed Sidebar */}
      <aside
        className="admin-sidebar-desktop"
        style={{
          width: 260,
          background: "var(--color-bg-card)",
          borderRight: "1px solid var(--color-border)",
          padding: "24px 0",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-menu-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={() => setIsMobileOpen(false)}
        style={{ zIndex: 1000 }}
      >
        <div
          className="mobile-menu-drawer"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 280, padding: "24px 0" }}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}

