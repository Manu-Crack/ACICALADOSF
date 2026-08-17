"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getAuthRedirectURL } from "@/lib/utils/url";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .single();

          const internalRoles = ["admin", "recepcionista", "empleado"];
          const redirectTo = profile && internalRoles.includes(profile.role)
            ? "/dashboard"
            : "/";

          window.location.href = redirectTo;
        } catch {
          window.location.href = "/";
        }
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión o configuración local.");
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setLoading(true);
    setError("");

    try {
      const redirectUrl = getAuthRedirectURL("/auth/callback");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión con proveedor social.";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(200,164,92,0.06) 0%, var(--color-bg) 60%)",
      }}
    >
      <div
        className="card card-gold"
        style={{ maxWidth: 420, width: "100%", padding: 32 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          <Link
            href="/"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: "flex-start", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ← Volver
          </Link>
          <div style={{ textAlign: "center" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
              <h1
                className="text-gold"
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                INICIAR SESIÓN
              </h1>
            </Link>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <img src="/icons/Google.svg" alt="Google" style={{ width: 18, height: 18 }} />
            Continuar con Google
          </button>

        </div>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-dim)",
              fontWeight: 500,
            }}
          >
            o con correo
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailLogin}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  padding: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--color-text-dim, #9ca3af)",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-primary, #c8a45c)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-dim, #9ca3af)")}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(184,59,46,0.1)",
                border: "1px solid rgba(184,59,46,0.2)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-error)",
                fontSize: "0.875rem",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          ¿No tienes cuenta?{" "}
          <Link href="/auth/register" style={{ fontWeight: 600 }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
