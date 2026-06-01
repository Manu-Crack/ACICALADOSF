import Link from "next/link";

const socialLinks = [
  { name: "Instagram", href: "#", icon: "📸" },
  { name: "Facebook", href: "#", icon: "📘" },
  { name: "TikTok", href: "#", icon: "🎵" },
  { name: "WhatsApp", href: "https://wa.me/", icon: "💬" },
  { name: "YouTube", href: "#", icon: "🎬" },
];

export function Footer() {
  return (
    <footer
      style={{
        background: "var(--color-bg-card)",
        borderTop: "1px solid var(--color-border)",
        padding: "60px 24px 32px",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 40,
        }}
      >
        {/* Brand */}
        <div>
          <h3
            className="text-gold"
            style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: 12 }}
          >
            ACICALADOS
          </h3>
          <p
            className="text-muted"
            style={{ fontSize: "0.875rem", lineHeight: 1.7 }}
          >
            Spa & Barbería premium. Tu mejor versión te espera.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 600,
              fontSize: "0.875rem",
              marginBottom: 16,
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Enlaces
          </h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <Link
              href="/#servicios"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Servicios
            </Link>
            <Link
              href="/vestuario"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Vestuario
            </Link>
            <Link
              href="/tienda"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Tienda
            </Link>
            <Link
              href="/blog"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Blog
            </Link>
            <Link
              href="/reservar"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              Reservar
            </Link>
          </div>
        </div>

        {/* Social */}
        <div>
          <h4
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 600,
              fontSize: "0.875rem",
              marginBottom: 16,
              color: "var(--color-primary)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            Síguenos
          </h4>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {socialLinks.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                title={s.name}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.125rem",
                  transition: "all var(--transition-fast)",
                }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 600,
              fontSize: "0.875rem",
              marginBottom: 16,
              color: "var(--color-primary)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
            }}
          >
            Contacto
          </h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <a
              href="https://maps.app.goo.gl/9ojPm9qdawhvqEYu9"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              📍 Ver ubicación
            </a>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}
            >
              💬 WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1200,
          margin: "40px auto 0",
          paddingTop: 20,
          borderTop: "1px solid var(--color-border)",
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--color-text-dim)",
        }}
      >
        © {new Date().getFullYear()} Acicalados Spa & Barber Shop. Todos los
        derechos reservados.
      </div>
    </footer>
  );
}
