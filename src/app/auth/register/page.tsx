"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName} ${lastName}`.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
      <div className="card card-gold" style={{ maxWidth: 420, width: "100%", padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1
              className="text-gold"
              style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}
            >
              ACICALADOS
            </h1>
          </Link>
          <p className="text-muted" style={{ fontSize: "0.9375rem" }}>
            Crea tu cuenta
          </p>
        </div>

        {/* OAuth */}
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
            <label className="label" htmlFor="regEmail">Correo</label>
            <input id="regEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="label" htmlFor="regPassword">Contraseña</label>
            <input id="regPassword" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(184,59,46,0.1)", border: "1px solid rgba(184,59,46,0.2)", borderRadius: "var(--radius-md)", color: "var(--color-error)", fontSize: "0.875rem", marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
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
