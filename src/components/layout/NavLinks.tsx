"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkItem {
  label: string;
  href: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Vestuario", href: "/vestuario" },
  { label: "Productos", href: "/tienda" },
  { label: "Blog", href: "/blog" },
  { label: "Ubicación", href: "/ubicacion" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
      {NAV_LINKS.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(link.href + "/");

        return (
          <Link
            key={link.label}
            href={link.href}
            className={`text-sm lg:text-[15px] transition-all duration-200 relative pb-1.5 pt-1 font-medium tracking-wide ${
              isActive
                ? "text-[#C8A45C] font-semibold after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2.5px] after:bg-[#C8A45C] after:rounded-full after:shadow-[0_0_8px_rgba(200,164,92,0.6)]"
                : "text-gray-300 hover:text-white hover:text-[#EBDBB2]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
