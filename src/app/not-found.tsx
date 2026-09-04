import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 20px 80px",
          background: "transparent",
        }}
      >
        <div
          className="card card-gold animate-fadeIn"
          style={{
            maxWidth: 520,
            width: "100%",
            textAlign: "center",
            padding: "48px 24px",
            background: "rgba(14, 12, 8, 0.85)",
            backdropFilter: "blur(16px)",
          }}
        >
          <span style={{ fontSize: "3.5rem", display: "block", marginBottom: 12 }}>
            ✂️
          </span>
          <span className="badge badge-gold" style={{ marginBottom: 16 }}>
            ERROR 404
          </span>
          <h1
            className="heading-lg"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              marginBottom: 12,
              color: "#FFFFFF",
            }}
          >
            Página o Artículo no encontrado
          </h1>
          <p
            className="text-muted"
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              marginBottom: 32,
            }}
          >
            La página que buscas ha sido movida, eliminada o no se encuentra disponible en este momento.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/servicios" className="btn btn-secondary">
              Ver Servicios
            </Link>
            <Link href="/" className="btn btn-primary">
              Volver al Inicio
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
