"use client";

import { useState, useEffect, useRef } from "react";
import type { PaymentSettings } from "@/lib/types/settings";
import { DEFAULT_PAYMENT_SETTINGS } from "@/lib/types/settings";

interface PaymentSettingsModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaymentSettingsModal({ onClose, onSuccess }: PaymentSettingsModalProps) {
  const [recipientName, setRecipientName] = useState(DEFAULT_PAYMENT_SETTINGS.recipient_name);
  const [yapePhone, setYapePhone] = useState(DEFAULT_PAYMENT_SETTINGS.yape_phone);
  const [advancePct, setAdvancePct] = useState(DEFAULT_PAYMENT_SETTINGS.advance_percentage);
  const [baseMessage, setBaseMessage] = useState(DEFAULT_PAYMENT_SETTINGS.base_message);
  const [isActive, setIsActive] = useState(DEFAULT_PAYMENT_SETTINGS.is_active);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar configuración existente
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/payment-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            const s = data.settings as PaymentSettings;
            setRecipientName(s.recipient_name);
            setYapePhone(s.yape_phone);
            setAdvancePct(s.advance_percentage);
            setBaseMessage(s.base_message);
            setIsActive(s.is_active);
            setQrImageUrl(s.qr_image_url);
          }
        }
      } catch {
        setError("Error al cargar la configuración de pagos.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleQrUpload = async (file: File | null) => {
    if (!file) return;

    setUploadingQr(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/payment-settings/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo subir la imagen del QR.");
        return;
      }

      setQrImageUrl(data.url);
      setSuccessMsg("Código QR actualizado en Storage.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Error de conexión al subir el QR.");
    } finally {
      setUploadingQr(false);
    }
  };

  const handleQrRemove = async () => {
    if (!qrImageUrl) return;
    if (!confirm("¿Deseas eliminar la imagen actual del código QR?")) return;

    setUploadingQr(true);
    try {
      await fetch(`/api/admin/payment-settings/upload?url=${encodeURIComponent(qrImageUrl)}`, {
        method: "DELETE",
      });
      setQrImageUrl(null);
      setSuccessMsg("Imagen QR eliminada.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Error al eliminar la imagen.");
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          yape_phone: yapePhone.replace(/\D/g, ""),
          advance_percentage: Number(advancePct),
          base_message: baseMessage.trim(),
          is_active: isActive,
          qr_image_url: qrImageUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo guardar la configuración.");
        return;
      }

      setSuccessMsg(data.message || "Configuración guardada exitosamente.");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch {
      setError("Error de conexión al guardar los ajustes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(5px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes de Cobro y Pagos Yape"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "26px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              ⚙️ Ajustes de Cobro y Pagos
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              Configura el titular, número de Yape, QR y porcentaje de adelanto
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <p className="text-muted">Cargando ajustes...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Titular y Teléfono */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="label" htmlFor="recipient-name">
                  Titular de la cuenta
                </label>
                <input
                  id="recipient-name"
                  type="text"
                  className="input"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ej: Jorjito"
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="yape-phone">
                  Número de Yape
                </label>
                <input
                  id="yape-phone"
                  type="text"
                  className="input"
                  value={yapePhone}
                  onChange={(e) => setYapePhone(e.target.value)}
                  placeholder="Ej: 51997766828"
                  required
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* % Adelanto y Estado */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "center" }}>
              <div>
                <label className="label" htmlFor="advance-pct">
                  Porcentaje de adelanto (%)
                </label>
                <input
                  id="advance-pct"
                  type="number"
                  min="1"
                  max="100"
                  className="input"
                  value={advancePct}
                  onChange={(e) => setAdvancePct(Number(e.target.value))}
                  required
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ paddingTop: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "var(--color-text)" }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--color-primary)" }}
                  />
                  <strong>Cobros Yape Activos</strong>
                </label>
              </div>
            </div>

            {/* QR Image Management */}
            <div>
              <label className="label">Imagen del Código QR Yape</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "rgba(200, 164, 92, 0.04)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background: "#FFFFFF",
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                    border: "1px solid rgba(200, 164, 92, 0.4)",
                  }}
                >
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt="QR actual" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: "1.5rem" }}>💜</span>
                  )}
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => handleQrUpload(e.target.files?.[0] || null)}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary btn-sm"
                      disabled={uploadingQr}
                    >
                      {uploadingQr ? "Subiendo..." : "📸 Subir nuevo QR"}
                    </button>
                    {qrImageUrl && (
                      <button
                        type="button"
                        onClick={handleQrRemove}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                        disabled={uploadingQr}
                      >
                        🗑️ Quitar
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", margin: 0 }}>
                    Formatos: JPG, PNG o WebP (Máx. 5 MB).
                  </p>
                </div>
              </div>
            </div>

            {/* Mensaje Base */}
            <div>
              <label className="label" htmlFor="base-message">
                Mensaje base para WhatsApp
              </label>
              <textarea
                id="base-message"
                className="input"
                rows={2}
                value={baseMessage}
                onChange={(e) => setBaseMessage(e.target.value)}
                style={{ width: "100%", resize: "vertical", fontSize: "0.82rem" }}
              />
            </div>

            {error && (
              <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
                ❌ {error}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(106, 153, 78, 0.15)", color: "var(--color-success)", fontSize: "0.8rem", fontWeight: 600 }}>
                ✅ {successMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
