import Link from "next/link";

const socialLinks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/SpaAcicaladosBarberShop",
    icon: <img src="/icons/Facebook.svg" alt="Facebook" style={{ width: "100%", height: "100%", borderRadius: "9px" }} />
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/spaacicaladosbarbershop",
    icon: <img src="/icons/Instagram.svg" alt="Instagram" style={{ width: "100%", height: "100%", borderRadius: "9px" }} />
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@spa_acicalados?lang=es",
    icon: <img src="/icons/Tiktok.svg" alt="TikTok" style={{ width: "100%", height: "100%", borderRadius: "9px" }} />
  },
  {
    name: "Youtube",
    href: "https://www.youtube.com/@AcicaladosSPA",
    icon: <img src="/icons/Youtube.svg" alt="Youtube" style={{ width: "95%", height: "95%", borderRadius: "9px" }} />
  }
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
            style={{
              fontWeight: 800,
              fontSize: "1.25rem",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <img
              src="/LogoAcicalados.svg"
              alt="Logo Acicalados"
              style={{ height: 24, width: "auto" }}
            />
            ACICALADOS
          </h3>
          <p
            className="text-muted"
            style={{ fontSize: "0.875rem", lineHeight: 1.7 }}
          >
            Spa & Barbería premium. Tu mejor versión te espera.
          </p>
        </div>



        {/* Navigation */}
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
            Navegación
          </h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { name: "Inicio", href: "/" },
              { name: "Servicios", href: "/servicios" },
              { name: "Vestuario", href: "/vestuario" },
              { name: "Productos", href: "/tienda" },
              { name: "Blog", href: "/blog" },
            ].map((sec) => (
              <li key={sec.name}>
                <Link
                  href={sec.href}
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    transition: "color var(--transition-fast)",
                  }}
                >
                  <span>{sec.name}</span>
                </Link>
              </li>
            ))}
          </ul>
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
                className="hover:scale-110 active:scale-95 transition-transform duration-200 ease-out"
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
              href="https://wa.me/51997766828"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <img
                src="/icons/whatsApp.svg"
                alt="WhatsApp"
                style={{ width: 30, height: 30 }}
              />
              WhatsApp
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
