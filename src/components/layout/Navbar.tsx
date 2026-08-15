import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CartButton } from "@/components/cart/CartButton";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { NavLinks } from "@/components/layout/NavLinks";
import { NavSearch } from "@/components/layout/NavSearch";
import { NavUserButton } from "@/components/layout/NavUserButton";

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#C8A45C]/35 shadow-[0_4px_25px_rgba(0,0,0,0.85)]">
      <div className="max-w-[1440px] mx-auto h-[74px] sm:h-[78px] px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        {/* SECCIÓN IZQUIERDA (Marca & Logo) */}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center group cursor-pointer"
            aria-label="Acicalados - Inicio"
          >
            {/* Logo */}
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              className="h-10 sm:h-12 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />

            {/* Separador vertical sutil */}
            <div className="h-8 w-[1px] bg-[#C8A45C]/35 mx-3 sm:mx-4.5" />

            {/* Texto de la marca */}
            <div className="flex flex-col justify-center select-none">
              <span
                className="font-serif font-bold text-base sm:text-lg lg:text-xl tracking-[0.2em] text-[#C8A45C] group-hover:text-[#EBDBB2] transition-colors leading-none"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                ACICALADOS
              </span>
              <span
                className="tracking-[0.28em] text-[9px] sm:text-[10px] text-[#C8A45C]/80 font-semibold leading-none mt-1"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                DISEÑO &amp; CALIDAD
              </span>
            </div>
          </Link>
        </div>

        {/* SECCIÓN CENTRAL (Enlaces de Navegación) */}
        <NavLinks />

        {/* SECCIÓN DERECHA (Acciones, Carrito, Usuario & Menú) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Lupa (Búsqueda interactiva) */}
          <NavSearch />

          {/* Separador vertical sutil */}
          <div className="h-6 w-[1px] bg-[#C8A45C]/30 mx-1 hidden sm:block" />

          {/* Botón de Carrito (Pill con borde dorado y badge circular) */}
          <CartButton />

          {/* Botón de Usuario (Pill con borde dorado, nombre y chevron) */}
          <div className="hidden sm:block">
            <NavUserButton
              user={!!user}
              profileName={profile?.first_name}
              isInternal={isInternal}
              onSignOut={handleSignOut}
            />
          </div>

          {/* Menú Hamburguesa con líneas doradas */}
          <MobileMenu
            user={!!user}
            profileName={profile?.first_name}
            isInternal={isInternal}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </header>
  );
}
