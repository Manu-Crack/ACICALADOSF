"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Egreso,
  EXPENSE_CATEGORIES,
  formatCentsToSoles,
  getCategoryInfo,
} from "@/lib/types/expense";
import { EgresoFormModal } from "./EgresoFormModal";
import { createClient } from "@/lib/supabase/client";

interface EgresosManagerProps {
  initialEgresos: Egreso[];
  userRole?: string;
}

export function EgresosManager({
  initialEgresos,
  userRole = "admin",
}: EgresosManagerProps) {
  const [egresos, setEgresos] = useState<Egreso[]>(initialEgresos);
  const [loading, setLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Filters
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("month");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEgreso, setEditingEgreso] = useState<Egreso | null>(null);
  const [deleteConfirmEgreso, setDeleteConfirmEgreso] = useState<Egreso | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const supabase = useMemo(() => createClient(), []);

  // Helper date ranges in local timezone
  const computeDateBounds = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    if (timeRange === "day") {
      return { start: todayStr, end: todayStr };
    }
    if (timeRange === "week") {
      const cur = new Date();
      const dayOfWeek = cur.getDay(); // 0 is Sunday
      const diffToMonday = cur.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(cur.setDate(diffToMonday));
      const mYear = monday.getFullYear();
      const mMonth = String(monday.getMonth() + 1).padStart(2, "0");
      const mDay = String(monday.getDate()).padStart(2, "0");
      const mondayStr = `${mYear}-${mMonth}-${mDay}`;

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sYear = sunday.getFullYear();
      const sMonth = String(sunday.getMonth() + 1).padStart(2, "0");
      const sDay = String(sunday.getDate()).padStart(2, "0");
      const sundayStr = `${sYear}-${sMonth}-${sDay}`;

      return { start: mondayStr, end: sundayStr };
    }
    if (timeRange === "month") {
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      return {
        start: `${year}-${month}-01`,
        end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
      };
    }
    return { start: null, end: null };
  }, [timeRange]);

  // Load data from API or Supabase
  const loadEgresos = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = computeDateBounds();
      let url = "/api/admin/egresos?";
      const params = new URLSearchParams();
      if (start) params.append("start_date", start);
      if (end) params.append("end_date", end);
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (searchQuery && searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      url += params.toString();

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEgresos(data || []);
      }
    } catch (err) {
      console.error("Error al cargar egresos:", err);
    } finally {
      setLoading(false);
    }
  }, [computeDateBounds, selectedCategory, searchQuery]);

  const loadEgresosRef = useRef(loadEgresos);
  useEffect(() => {
    loadEgresosRef.current = loadEgresos;
  }, [loadEgresos]);

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    async function initRealtime() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }

        if (!isMounted) return;

        const channelName = "realtime-egresos-manager";
        const existing = supabase.getChannels().find(
          (c: { topic: string }) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          supabase.removeChannel(existing);
        }

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "egresos",
            },
            () => {
              if (loadEgresosRef.current) {
                loadEgresosRef.current();
              }
            }
          )
          .subscribe((status: string) => {
            if (status === "SUBSCRIBED") {
              setIsRealtimeConnected(true);
            } else {
              setIsRealtimeConnected(false);
            }
          });
      } catch (err) {
        console.error("Error en Realtime Egresos:", err);
      }
    }

    initRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase]);

  // Trigger reload on filter change
  useEffect(() => {
    loadEgresos();
  }, [loadEgresos]);

  // Handle toast timeout
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  const handleOpenCreate = () => {
    setEditingEgreso(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (egreso: Egreso) => {
    setEditingEgreso(egreso);
    setIsModalOpen(true);
  };

  const handleSaved = (saved: Egreso) => {
    setEgresos((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSuccessToast(
      editingEgreso ? "Egreso actualizado con éxito." : "Egreso registrado con éxito."
    );
  };

  const handleDelete = async () => {
    if (!deleteConfirmEgreso) return;
    try {
      setDeleting(true);
      setActionError("");
      const res = await fetch(`/api/admin/egresos?id=${deleteConfirmEgreso.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al eliminar el egreso");
      }

      setEgresos((prev) => prev.filter((e) => e.id !== deleteConfirmEgreso.id));
      setDeleteConfirmEgreso(null);
      setSuccessToast("Egreso eliminado correctamente.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al eliminar";
      setActionError(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Calculations for summary cards
  const totalCents = useMemo(() => {
    return egresos.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0);
  }, [egresos]);

  const maxExpenseCents = useMemo(() => {
    if (!egresos.length) return 0;
    return Math.max(...egresos.map((e) => e.amount_cents || 0));
  }, [egresos]);

  const avgExpenseCents = useMemo(() => {
    if (!egresos.length) return 0;
    return Math.round(totalCents / egresos.length);
  }, [egresos, totalCents]);

  return (
    <div>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1100,
            background: "#141414",
            border: "1px solid var(--color-success)",
            color: "var(--color-text)",
            borderRadius: "var(--radius-md)",
            padding: "12px 20px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "0.9rem",
          }}
        >
          <span style={{ color: "var(--color-success)", fontSize: "1.1rem" }}>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="heading-lg" style={{ margin: 0 }}>
            💸 Gestión de Egresos
          </h1>
          <p className="text-muted" style={{ marginTop: 4, fontSize: "0.9rem" }}>
            Control y registro de salidas de dinero, compras operativas y gastos de Acicalados.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Realtime indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(200, 164, 92, 0.05)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isRealtimeConnected ? "var(--color-success)" : "#f59e0b",
                display: "inline-block",
                boxShadow: isRealtimeConnected
                  ? "0 0 8px var(--color-success)"
                  : "0 0 8px #f59e0b",
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: isRealtimeConnected ? "var(--color-success)" : "var(--color-text-muted)",
              }}
            >
              {isRealtimeConnected ? "🟢 En vivo" : "🟡 Sincronizando..."}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>+</span>
            <span>Registrar Egreso</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-4" style={{ marginBottom: 28 }}>
        {/* Total Egresos */}
        <div
          className="card"
          style={{
            borderLeft: "4px solid #ef4444",
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(20, 20, 20, 0.95) 100%)",
          }}
        >
          <p className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Egresos ({timeRange === "day" ? "Hoy" : timeRange === "week" ? "Esta Semana" : timeRange === "month" ? "Este Mes" : "Histórico"})
          </p>
          <p
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "#f87171",
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {formatCentsToSoles(totalCents)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            {egresos.length} {egresos.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {/* Cantidad de Gastos */}
        <div className="card">
          <p className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            N° de Transacciones
          </p>
          <p
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "var(--color-primary)",
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {egresos.length}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Salidas registradas
          </span>
        </div>

        {/* Mayor Gasto */}
        <div className="card">
          <p className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Mayor Egreso
          </p>
          <p
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "#fb923c",
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {formatCentsToSoles(maxExpenseCents)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Pico individual
          </span>
        </div>

        {/* Promedio por Gasto */}
        <div className="card">
          <p className="text-muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Promedio por Gasto
          </p>
          <p
            style={{
              fontSize: "1.65rem",
              fontWeight: 800,
              color: "#38bdf8",
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {formatCentsToSoles(avgExpenseCents)}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Ticket promedio
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: "16px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Time Tabs */}
        <div
          style={{
            display: "inline-flex",
            background: "#0A0A0A",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "3px",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => setTimeRange("day")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: timeRange === "day" ? "var(--color-primary)" : "transparent",
              color: timeRange === "day" ? "#000" : "var(--color-text-muted)",
              transition: "all var(--transition-fast)",
            }}
          >
            Día (Hoy)
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("week")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: timeRange === "week" ? "var(--color-primary)" : "transparent",
              color: timeRange === "week" ? "#000" : "var(--color-text-muted)",
              transition: "all var(--transition-fast)",
            }}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("month")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: timeRange === "month" ? "var(--color-primary)" : "transparent",
              color: timeRange === "month" ? "#000" : "var(--color-text-muted)",
              transition: "all var(--transition-fast)",
            }}
          >
            Mes
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("all")}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.825rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: timeRange === "all" ? "var(--color-primary)" : "transparent",
              color: timeRange === "all" ? "#000" : "var(--color-text-muted)",
              transition: "all var(--transition-fast)",
            }}
          >
            Todos
          </button>
        </div>

        {/* Category Filter & Search Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              background: "#0A0A0A",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              minWidth: "160px",
            }}
          >
            <option value="all">Todas las Categorías</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="🔍 Buscar por descripción, proveedor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              background: "#0A0A0A",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              width: "240px",
            }}
          />
        </div>
      </div>

      {/* Egresos Table Card */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p className="text-muted">Cargando egresos...</p>
          </div>
        ) : egresos.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <span style={{ fontSize: "2.5rem" }}>🧾</span>
            <h3 style={{ marginTop: 12, color: "var(--color-text)", fontSize: "1.1rem" }}>
              No se encontraron egresos
            </h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 4 }}>
              No hay gastos registrados para los filtros seleccionados.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="btn btn-primary btn-sm"
              style={{ marginTop: 16 }}
            >
              + Registrar Primer Egreso
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Fecha</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Descripción</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Categoría</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Proveedor / Info</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)" }}>Método</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "right" }}>Monto</th>
                  <th style={{ padding: "12px 16px", fontSize: "0.8rem", fontWeight: 600, color: "var(--color-text-muted)", textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {egresos.map((e) => {
                  const catInfo = getCategoryInfo(e.category);
                  return (
                    <tr
                      key={e.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        transition: "background var(--transition-fast)",
                      }}
                    >
                      {/* Fecha */}
                      <td style={{ padding: "12px 16px", fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600 }}>{e.expense_date}</span>
                      </td>

                      {/* Descripción */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)" }}>
                          {e.description}
                        </div>
                        {e.notes && (
                          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 2 }}>
                            {e.notes}
                          </div>
                        )}
                      </td>

                      {/* Categoría */}
                      <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: `${catInfo.color}18`,
                            color: catInfo.color,
                            border: `1px solid ${catInfo.color}35`,
                          }}
                        >
                          <span>{catInfo.icon}</span>
                          <span>{catInfo.label}</span>
                        </span>
                      </td>

                      {/* Proveedor / Comprobante */}
                      <td style={{ padding: "12px 16px", fontSize: "0.825rem" }}>
                        {e.supplier ? (
                          <div style={{ fontWeight: 500, color: "var(--color-text)" }}>{e.supplier}</div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {e.receipt_type && e.receipt_type !== "ninguno" && (
                          <div style={{ fontSize: "0.725rem", color: "var(--color-primary)", marginTop: 2 }}>
                            {e.receipt_type.toUpperCase()} {e.receipt_number ? `(${e.receipt_number})` : ""}
                          </div>
                        )}
                      </td>

                      {/* Método de pago */}
                      <td style={{ padding: "12px 16px", fontSize: "0.825rem", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                        <span className="badge badge-neutral" style={{ fontSize: "0.725rem" }}>
                          {e.payment_method}
                        </span>
                      </td>

                      {/* Monto */}
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: "#f87171",
                          whiteSpace: "nowrap",
                        }}
                      >
                        - {formatCentsToSoles(e.amount_cents)}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: "12px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(e)}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--color-text)",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                            title="Editar egreso"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmEgreso(e)}
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              borderRadius: "var(--radius-sm)",
                              color: "#f87171",
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                            title="Eliminar egreso"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <EgresoFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        egresoToEdit={editingEgreso}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmEgreso && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setDeleteConfirmEgreso(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px",
              width: "100%",
              backgroundColor: "#141414",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: "#f87171", margin: 0, fontSize: "1.1rem" }}>
              ⚠️ Confirmar Eliminación
            </h3>
            <p style={{ fontSize: "0.875rem", marginTop: 12, color: "var(--color-text)" }}>
              ¿Estás seguro de que deseas eliminar el egreso:
            </p>
            <p style={{ fontWeight: 600, color: "var(--color-primary)", marginTop: 4 }}>
              "{deleteConfirmEgreso.description}" por {formatCentsToSoles(deleteConfirmEgreso.amount_cents)}?
            </p>
            <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: 8 }}>
              Esta acción no se puede deshacer.
            </p>

            {actionError && (
              <p style={{ color: "var(--color-error)", fontSize: "0.8rem", marginTop: 10 }}>
                {actionError}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmEgreso(null)}
                disabled={deleting}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn btn-sm"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  fontWeight: 600,
                }}
              >
                {deleting ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
