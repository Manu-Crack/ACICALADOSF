import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartButton } from "@/components/cart/CartButton";
import { MobileMenu } from "@/components/layout/MobileMenu";

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
    !!profile &&
    ["admin", "recepcionista", "empleado"].includes(profile.role);

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

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

        {/* Nav Links - Desktop */}
        <div className="nav-links-desktop">
          <Link href="/">Inicio</Link>
          <Link href="/servicios">Servicios</Link>
          <Link href="/vestuario">Vestuario</Link>
          <Link href="/tienda">Productos</Link>
          <Link href="/blog">Blog</Link>
        </div>

        {/* Actions / Auth / Mobile menu */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Desktop Auth Links */}
          <div className="nav-auth-desktop">
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
                  action={handleSignOut}
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
          </div>

          {/* Cart Button (visible on mobile and desktop) */}
          <CartButton />

          {/* Mobile Menu Trigger & Panel */}
          <MobileMenu
            user={!!user}
            profileName={profile?.first_name}
            isInternal={isInternal}
            onSignOut={handleSignOut}
          />
        </div>
      </nav>
    </header>
  );
}
