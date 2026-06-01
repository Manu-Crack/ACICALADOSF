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
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
