import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartButton } from "@/components/cart/CartButton";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const isInternal =
    profile &&
    ["admin", "recepcionista", "empleado"].includes(profile.role);

  return (
    <header
      className="glass"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: "0 24px",
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 800,
            fontSize: "1.25rem",
            letterSpacing: "0.08em",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <img
            src="/LogoAcicalados.svg"
            alt="Logo Acicalados"
            style={{ height: 28, width: "auto" }}
          />
          <span className="text-gold">ACICALADOS</span>
        </Link>

        {/* Nav Links */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <Link
            href="/#inicio"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Inicio
          </Link>
          <Link
            href="/#servicios"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Servicios
          </Link>
          <Link
            href="/vestuario"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Vestuarios
          </Link>
          <Link
            href="/tienda"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Tienda
          </Link>
          <Link
            href="/blog"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Blog
          </Link>
          <Link
            href="/ubicacion"
            className="btn-ghost"
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              transition: "color var(--transition-fast)",
              padding: "8px 0",
            }}
          >
            Ubicación
          </Link>
        </div>

        {/* Auth / Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <>
              {isInternal && (
                <Link href="/dashboard" className="btn btn-ghost btn-sm">
                  Panel
                </Link>
              )}
              <Link href="/mi-cuenta" className="btn btn-secondary btn-sm">
                {profile?.first_name || "Mi Cuenta"}
              </Link>
              <form
                action={async () => {
                  "use server";
                  const supabase = await createClient();
                  await supabase.auth.signOut();
                  redirect("/");
                }}
                style={{ display: "inline" }}
              >
                <button type="submit" className="btn btn-ghost btn-sm">
                  Cerrar Sesión
                </button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className="btn btn-secondary btn-sm">
              Iniciar Sesión
            </Link>
          )}
          <CartButton />
        </div>
      </nav>
    </header>
  );
}
