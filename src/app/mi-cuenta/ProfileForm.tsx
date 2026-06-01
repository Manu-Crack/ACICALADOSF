"use client";

import { useState, useRef } from "react";

type ProfileData = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  dni: string | null;
} | null;

export function ProfileForm({
  profile,
  email,
  updateAction,
}: {
  profile: ProfileData;
  email: string;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setSaved(false);
    try {
      await updateAction(formData);
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handling
    }
    setSaving(false);
  }

  if (!isEditing) {
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>Nombre</p>
            <p style={{ fontWeight: 500 }}>{profile?.first_name || "—"}</p>
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>Apellido</p>
            <p style={{ fontWeight: 500 }}>{profile?.last_name || "—"}</p>
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>Correo</p>
            <p style={{ fontWeight: 500 }}>{email}</p>
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>Teléfono</p>
            <p style={{ fontWeight: 500 }}>{profile?.phone || "—"}</p>
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>DNI</p>
            <p style={{ fontWeight: 500 }}>{profile?.dni || "—"}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-secondary btn-sm"
          >
            ✏️ Editar datos
          </button>
          {saved && (
            <span style={{ color: "var(--color-success)", fontSize: "0.875rem", fontWeight: 500 }}>
              ✅ Datos guardados correctamente
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label className="label" htmlFor="edit-first-name">Nombre</label>
          <input
            id="edit-first-name"
            name="first_name"
            className="input"
            defaultValue={profile?.first_name || ""}
            placeholder="Tu nombre"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="edit-last-name">Apellido</label>
          <input
            id="edit-last-name"
            name="last_name"
            className="input"
            defaultValue={profile?.last_name || ""}
            placeholder="Tu apellido"
            required
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="label" htmlFor="edit-email">Correo electrónico</label>
        <input
          id="edit-email"
          className="input"
          value={email}
          disabled
          style={{ opacity: 0.5, cursor: "not-allowed" }}
        />
        <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
          El correo no se puede modificar
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <label className="label" htmlFor="edit-phone">Teléfono</label>
          <input
            id="edit-phone"
            name="phone"
            className="input"
            defaultValue={profile?.phone || ""}
            placeholder="987654321"
            maxLength={15}
          />
        </div>
        <div>
          <label className="label" htmlFor="edit-dni">DNI</label>
          <input
            id="edit-dni"
            name="dni"
            className="input"
            defaultValue={profile?.dni || ""}
            placeholder="12345678"
            maxLength={8}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="btn btn-ghost"
          style={{ flex: 1 }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {saving ? "Guardando..." : "💾 Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
