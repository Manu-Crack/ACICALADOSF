"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getAuthRedirectURL } from "@/lib/utils/url";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Criterios de complejidad de contraseña
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isPasswordValid) {
      setError("La contraseña no cumple con todos los requisitos de seguridad.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName} ${lastName}`.trim(),
          },
          emailRedirectTo: getAuthRedirectURL("/auth/callback"),
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión o configuración local.";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAuthRedirectURL("/auth/callback"),
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="card card-gold" style={{ maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📧</div>
          <h2 className="heading-md" style={{ marginBottom: 12 }}>
            ¡Revisa tu correo!
          </h2>
          <p className="text-muted" style={{ marginBottom: 8 }}>
            Hemos enviado un enlace de confirmación a:
          </p>
          <p style={{ fontWeight: 700, color: "var(--color-primary)", marginBottom: 16, fontSize: "1.0625rem" }}>
            {email}
          </p>
          <p className="text-muted" style={{ marginBottom: 24, fontSize: "0.875rem", lineHeight: 1.6 }}>
            Haz clic en el enlace del correo para activar tu cuenta.
            Si no lo encuentras, revisa tu carpeta de <strong>spam</strong> o correo no deseado.
          </p>
          <Link href="/auth/login" className="btn btn-primary" style={{ width: "100%" }}>
            Ir al Login
          </Link>
        </div>
      </div>
    );
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
      <div className="card card-gold" style={{ maxWidth: 460, width: "100%", padding: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
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
                REGISTRAR USUARIO
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
          <button
            onClick={() => handleOAuth("facebook")}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <img src="/icons/Facebook.svg" alt="Facebook" style={{ width: 18, height: 18 }} />
            Continuar con Facebook
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-dim)" }}>o con correo</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label" htmlFor="firstName">Nombre</label>
              <input id="firstName" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Juan" />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Apellido</label>
              <input id="lastName" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Pérez" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="regEmail">Correo electrónico</label>
            <input id="regEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: 14 }}>
            <label className="label" htmlFor="regPassword">Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                id="regPassword"
                type={showPassword ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 8 caracteres"
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

          {/* Indicadores dinámicos de complejidad */}
          {password.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--color-border)",
                fontSize: "0.75rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              <span style={{ color: hasMinLength ? "#22c55e" : "var(--color-text-muted)" }}>
                {hasMinLength ? "✓" : "✕"} Mínimo 8 caracteres
              </span>
              <span style={{ color: hasUppercase ? "#22c55e" : "var(--color-text-muted)" }}>
                {hasUppercase ? "✓" : "✕"} Una mayúscula (A-Z)
              </span>
              <span style={{ color: hasLowercase ? "#22c55e" : "var(--color-text-muted)" }}>
                {hasLowercase ? "✓" : "✕"} Una minúscula (a-z)
              </span>
              <span style={{ color: hasNumber ? "#22c55e" : "var(--color-text-muted)" }}>
                {hasNumber ? "✓" : "✕"} Un número (0-9)
              </span>
            </div>
          )}

          {/* Confirmar Contraseña */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="confirmPassword">Confirmar Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repite tu contraseña"
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirmPassword ? (
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

            {confirmPassword.length > 0 && (
              <p
                style={{
                  fontSize: "0.75rem",
                  marginTop: 6,
                  color: passwordsMatch ? "#22c55e" : "#ef4444",
                  fontWeight: 600,
                }}
              >
                {passwordsMatch ? "✓ Las contraseñas coinciden" : "✕ Las contraseñas no coinciden"}
              </p>
            )}
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
            disabled={loading || (password.length > 0 && (!isPasswordValid || !passwordsMatch))}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? "Creando cuenta..." : "Crear Cuenta"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" style={{ fontWeight: 600 }}>Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
