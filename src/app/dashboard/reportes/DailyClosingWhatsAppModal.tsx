"use client";

import { useState, useEffect, useCallback } from "react";

interface DailyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  userRole?: string;
}

interface ClosingItem {
  id: string;
  fullName: string;
  name: string;
  value: string;
  isPermission: boolean;
  amountCents: number;
}

interface ClosingResponse {
  success: boolean;
  date: string;
  formatted_date: string;
  report_text: string;
  whatsapp_url: string;
  items: ClosingItem[];
  products_total: string;
  wardrobe_total: string;
}

export function DailyClosingWhatsAppModal({
  isOpen,
  onClose,
  initialDate,
  userRole,
}: DailyClosingModalProps) {
  const isRecepcionista = userRole === "recepcionista";

  const getTodayPeruStr = useCallback(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (isRecepcionista) return getTodayPeruStr();
    if (initialDate) return initialDate;
    return getTodayPeruStr();
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ClosingResponse | null>(null);
  const [editableText, setEditableText] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sincronizar fecha inicial
  useEffect(() => {
    if (isRecepcionista) {
      setSelectedDate(getTodayPeruStr());
    } else if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate, isRecepcionista, getTodayPeruStr]);

  // Cargar datos del reporte de cierre diario
  const loadDailyClosing = useCallback(async (date: string) => {
    const effectiveDate = isRecepcionista ? getTodayPeruStr() : date;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reports/daily-closing?date=${effectiveDate}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al obtener reporte diario");
      }
      setReportData(data);
      setEditableText(data.report_text || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [isRecepcionista, getTodayPeruStr]);

  useEffect(() => {
    if (isOpen) {
      loadDailyClosing(selectedDate);
    }
  }, [isOpen, selectedDate, loadDailyClosing]);

  // Copiar al portapapeles
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Error al copiar:", err);
    }
  };

  // Abrir WhatsApp con texto genérico
  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(editableText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface, #18181b)",
          border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
          borderRadius: "var(--radius-lg, 16px)",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          color: "var(--color-text, #f4f4f5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--color-border, rgba(255,255,255,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(34, 197, 94, 0.08)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.3rem" }}>📱</span>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#22c55e", margin: 0 }}>
                Reporte Acicalados del Día (WhatsApp)
              </h2>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted, #a1a1aa)", margin: "4px 0 0 0" }}>
              Resumen diario estructurado por trabajador, ventas y vestuario para compartir a grupos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-muted, #a1a1aa)",
              fontSize: "1.25rem",
              cursor: "pointer",
              padding: 6,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Selector de fecha */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              padding: "12px 16px",
              borderRadius: "var(--radius-md, 8px)",
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
            }}
          >
            {isRecepcionista ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
                    Fecha del Cierre:
                  </label>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      color: "#22c55e",
                      background: "rgba(34, 197, 94, 0.12)",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm, 6px)",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                      }}
                    />
                    Hoy ({selectedDate})
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--color-text-muted)",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "var(--radius-sm, 6px)",
                    padding: "3px 8px",
                  }}
                >
                  🔒 Jornada activa exclusiva
                </span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>
                    Fecha del Cierre:
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{ fontSize: "0.85rem", padding: "4px 10px", width: "auto" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedDate(getTodayPeruStr());
                    }}
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    📅 Hoy
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setSelectedDate(yesterday.toISOString().split("T")[0]);
                    }}
                    style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                  >
                    ⏪ Ayer
                  </button>
                </div>
              </>
            )}
          </div>

          {errorMsg && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: "0.85rem",
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Vista previa / Edición del Texto */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-primary, #C8A45C)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Plantilla de Texto para WhatsApp (Exacta)
              </label>
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                Puedes editar el texto antes de enviar si lo deseas
              </span>
            </div>

            {loading ? (
              <div
                style={{
                  height: "220px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#0d1117",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                  color: "var(--color-text-muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                  <span>Calculando cierre del día...</span>
                </div>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  rows={10}
                  style={{
                    width: "100%",
                    background: "#090d13",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "var(--radius-md, 8px)",
                    color: "#e6edf3",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: "0.88rem",
                    lineHeight: 1.55,
                    padding: "14px 16px",
                    resize: "vertical",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                    outline: "none",
                  }}
                />
              </div>
            )}
          </div>

          {/* Desglose Rápido en Fila */}
          {reportData && !loading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--color-border, rgba(255,255,255,0.06))",
                borderRadius: "var(--radius-md, 8px)",
                fontSize: "0.75rem",
              }}
            >
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Colaboradores</span>
                <strong style={{ color: "#fff" }}>{reportData.items.length}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Con Permiso</span>
                <strong style={{ color: "#f59e0b" }}>
                  {reportData.items.filter((i) => i.isPermission).length}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Venta Productos</span>
                <strong style={{ color: "var(--color-success, #22c55e)" }}>S/ {reportData.products_total}</strong>
              </div>
              <div>
                <span style={{ color: "var(--color-text-muted)", display: "block" }}>Traje Vestuario</span>
                <strong style={{ color: "var(--color-success, #22c55e)" }}>S/ {reportData.wardrobe_total}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--color-border, rgba(255,255,255,0.1))",
            background: "rgba(0, 0, 0, 0.25)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.8rem", padding: "6px 14px" }}
          >
            Cerrar
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            {/* Botón Copiar Texto */}
            <button
              type="button"
              onClick={handleCopy}
              className="btn btn-ghost btn-sm"
              disabled={loading || !editableText.trim()}
              style={{
                fontSize: "0.8rem",
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid var(--color-border, rgba(255,255,255,0.1))",
                color: copied ? "#22c55e" : "#fff",
              }}
            >
              {copied ? "✅ ¡Copiado!" : "📋 Copiar Texto"}
            </button>

            {/* Botón Compartir por WhatsApp (Regla genérica sin número) */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={loading || !editableText.trim()}
              className="btn btn-primary btn-sm"
              style={{
                fontSize: "0.8rem",
                padding: "6px 16px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#22c55e",
                color: "#000",
                borderColor: "#22c55e",
                boxShadow: "0 2px 10px rgba(34, 197, 94, 0.35)",
              }}
              title="Abrir WhatsApp para seleccionar contacto o grupo destinatario"
            >
              <span>📲 Compartir Reporte por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
