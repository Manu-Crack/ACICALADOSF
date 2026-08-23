"use client";

import { useState, useEffect } from "react";
import { DEFAULT_BONUS_RULES, type BonusRule } from "@/lib/types/bonus";

interface BonusSettingsModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function BonusSettingsModal({ onClose, onSuccess }: BonusSettingsModalProps) {
  const [rules, setRules] = useState<BonusRule[]>(DEFAULT_BONUS_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadRules() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/attendance/bonus-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.rules && data.rules.length > 0) {
            setRules(data.rules);
          }
        }
      } catch (err) {
        console.error("Error loading bonus settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  const handleTimeChange = (dayOfWeek: number, timeStr: string) => {
    setRules((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, bonus_start_time: timeStr } : r))
    );
  };

  const handleToggleActive = (dayOfWeek: number, isActive: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.day_of_week === dayOfWeek ? { ...r, is_active: isActive } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/attendance/bonus-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudieron guardar las reglas.");
        return;
      }

      setSuccessMsg("Reglas de bonificación actualizadas correctamente.");
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
      aria-label="Configuración de Reglas de Bonificación"
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
              ⚙️ Reglas de Tiempo de Bonificación
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              Configura el horario de inicio de bonificación para cada día (Zona horaria: Perú / UTC-5)
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p className="text-muted">Cargando configuración...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rules.map((rule) => {
                const isSunday = rule.day_of_week === 0;
                return (
                  <div
                    key={rule.day_of_week}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: isSunday ? "rgba(200, 164, 92, 0.08)" : "rgba(200, 164, 92, 0.03)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={(e) => handleToggleActive(rule.day_of_week, e.target.checked)}
                        style={{ accentColor: "var(--color-primary)", width: 16, height: 16 }}
                      />
                      <div>
                        <strong style={{ fontSize: "0.88rem", color: "var(--color-text)" }}>
                          {rule.day_name}
                        </strong>
                        {isSunday && (
                          <span style={{ fontSize: "0.7rem", color: "var(--color-primary)", display: "block" }}>
                            Horario especial de domingo
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Inicia:</label>
                      <input
                        type="time"
                        className="input"
                        value={rule.bonus_start_time.slice(0, 5)}
                        onChange={(e) => handleTimeChange(rule.day_of_week, e.target.value)}
                        disabled={!rule.is_active}
                        style={{ padding: "4px 8px", fontSize: "0.82rem", width: 100 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
                ❌ {error}
              </div>
            )}

            {successMsg && (
              <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontSize: "0.8rem", fontWeight: 700 }}>
                ✅ {successMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving} style={{ flex: 1 }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
                {saving ? "Guardando..." : "Guardar Reglas"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
