"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Check role via server-side API (uses cookies, bypasses RLS issues)
    try {
      const res = await fetch("/api/auth/check-role");
      const { redirect: redirectTo } = await res.json();
      router.push(redirectTo || "/");
    } catch {
      router.push("/");
    }
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setLoading(true);
    setError("");

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
            Inicia sesión en tu cuenta
          </p>
        </div>

        {/* OAuth Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            🔵 Continuar con Google
          </button>
          <button
            onClick={() => handleOAuth("facebook")}
            disabled={loading}
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            🔷 Continuar con Facebook
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
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
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
