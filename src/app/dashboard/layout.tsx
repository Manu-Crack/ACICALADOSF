import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "recepcionista", "empleado"].includes(profile.role)) {
    redirect("/");
  }

  const isAdmin = profile.role === "admin";
  const isAdminOrRecep = ["admin", "recepcionista"].includes(profile.role);

  const navItems = [
    { href: "/dashboard", label: "Inicio", icon: "🏠", show: true },
    { href: "/dashboard/reservas", label: "Reservas", icon: "📋", show: isAdminOrRecep },
    { href: "/dashboard/empleados", label: "Empleados", icon: "👥", show: isAdmin },
    { href: "/dashboard/servicios", label: "Servicios", icon: "✂️", show: isAdmin },
    { href: "/dashboard/vestuario", label: "Vestuario", icon: "👔", show: isAdminOrRecep },
    { href: "/dashboard/productos", label: "Productos", icon: "🛍️", show: isAdmin },
    { href: "/dashboard/blog", label: "Blog", icon: "📝", show: isAdmin },
    { href: "/dashboard/contenido", label: "Contenido", icon: "📸", show: isAdmin },
    { href: "/dashboard/configuracion", label: "Configuración", icon: "⚙️", show: isAdmin },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
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
        {/* Logo */}
        <div style={{ padding: "0 20px", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              style={{ height: 24, width: "auto" }}
            />
            <span
              className="text-gold"
              style={{ fontWeight: 800, fontSize: "1.125rem" }}
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

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text-muted)",
                    transition: "all var(--transition-fast)",
                    textDecoration: "none",
                  }}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
          </div>
        </nav>

        {/* User */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>
            {profile.first_name} {profile.last_name}
          </p>
          <p className="badge badge-gold" style={{ marginTop: 4 }}>
            {profile.role}
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          marginLeft: 260,
          padding: 32,
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
