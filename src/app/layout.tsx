import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";

export const metadata: Metadata = {
  title: "Acicalados Spa & Barber Shop",
  description:
    "Reserva tu cita en Acicalados — Spa y Barbería premium. Servicios de belleza, cortes, tratamientos y más en un ambiente exclusivo.",
  keywords: [
    "spa",
    "barbería",
    "acicalados",
    "cortes de cabello",
    "tratamientos",
    "belleza",
    "reserva online",
  ],
  icons: {
    icon: "/LogoAcicalados.svg",
  },
  openGraph: {
    title: "Acicalados Spa & Barber Shop",
    description:
      "Reserva tu cita en Acicalados — Spa y Barbería premium.",
    type: "website",
    locale: "es_PE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="relative min-h-screen bg-black">
        {/* Global Fixed Background (fondo1.webp - Visible en todos los módulos y fijo al hacer scroll) */}
        <div className="global-fixed-bg" aria-hidden="true">
          <img
            src="/fondo1.webp"
            alt=""
            className="global-fixed-bg-img"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          {/* Suave viñeta ligera para mantener nitidez y luz natural */}
          <div className="global-fixed-bg-overlay" />
        </div>

        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
