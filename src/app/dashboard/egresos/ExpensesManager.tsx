"use client";

import { useState, useEffect, useCallback } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_ICONS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type Expense,
  type ExpenseCategory,
} from "@/lib/types/expenses";
import { ExpenseFormModal } from "./ExpenseFormModal";

export function ExpensesManager({ userRole = "admin" }: { userRole?: string }) {
  const isAdmin = userRole === "admin";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [voidingExpenseId, setVoidingExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);

      const res = await fetch(`/api/admin/expenses?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los egresos.");
        return;
      }

      setExpenses(data.expenses || []);
    } catch {
      setError("Error de conexión al cargar egresos.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Manejar Anulación de Egreso (Solo Admin)
  const handleVoidExpense = async (id: string) => {
    if (!voidReason.trim() || voidReason.trim().length < 5) {
      setVoidError("Ingresa un motivo válido de anulación (mínimo 5 caracteres).");
      return;
    }

    setVoidLoading(true);
    setVoidError(null);

    try {
      const res = await fetch(`/api/admin/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ void_reason: voidReason.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVoidError(data.error || "No se pudo anular el egreso.");
        return;
      }

      setVoidingExpenseId(null);
      setVoidReason("");
      fetchExpenses();
    } catch {
      setVoidError("Error de conexión al anular el egreso.");
    } finally {
      setVoidLoading(false);
    }
  };

  // Cálculo de totales activos
  const activeExpenses = expenses.filter((e) => e.status === "active");
  const totalActiveCents = activeExpenses.reduce((acc, curr) => acc + curr.amount_cents, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header y Botón Registrar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--color-primary)" }}>
            💸 Control de Egresos y Gastos Operativos
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: 4 }}>
            Registra y audita insumos, compras, mantenimiento y otros costos del establecimiento
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ➕ Nuevo Egreso
          </button>
        </div>
      </div>

      {/* KPI Cards de Egresos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
            Total Egresos Activos
          </span>
          <p style={{ fontSize: "1.4rem", fontWeight: 900, color: "#ef4444", margin: "6px 0 0" }}>
            S/ {(totalActiveCents / 100).toFixed(2)}
          </p>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
            {activeExpenses.length} egresos en el filtro actual
          </span>
        </div>

        <div
          className="card"
          style={{
            padding: "16px 20px",
            background: "rgba(200, 164, 92, 0.05)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--color-text-muted)", fontWeight: 700 }}>
            Categoría de Mayor Gasto
          </span>
          <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--color-text)", margin: "6px 0 0" }}>
            {(() => {
              const catTotals: Record<string, number> = {};
              activeExpenses.forEach((e) => {
                catTotals[e.category] = (catTotals[e.category] || 0) + e.amount_cents;
              });
              const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
              return sorted[0] ? `${EXPENSE_CATEGORY_ICONS[sorted[0][0] as ExpenseCategory] || ""} ${sorted[0][0]}` : "Sin gastos";
            })()}
          </p>
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
            Distribución automática por categoría
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div
        className="card"
        style={{
          padding: "14px 18px",
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Desde:</label>
          <input
            type="date"
            className="input"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Hasta:</label>
          <input
            type="date"
            className="input"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Categoría:</label>
          <select
            className="input"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_ICONS[cat]} {cat}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Estado:</label>
          <select
            className="input"
            style={{ padding: "4px 8px", fontSize: "0.8rem" }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Solo Activos</option>
            <option value="voided">Solo Anulados</option>
          </select>
        </div>

        {(startDate || endDate || selectedCategory !== "all" || selectedStatus !== "active") && (
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setSelectedCategory("all");
              setSelectedStatus("active");
            }}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla de Egresos */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <p className="text-muted">Cargando egresos...</p>
        </div>
      ) : error ? (
        <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444" }}>
          ❌ {error}
        </div>
      ) : expenses.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }} className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🧾</div>
          <p className="text-muted">No se encontraron egresos con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "rgba(200, 164, 92, 0.08)", borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px" }}>Fecha</th>
                  <th style={{ padding: "12px 14px" }}>Categoría</th>
                  <th style={{ padding: "12px 14px" }}>Descripción</th>
                  <th style={{ padding: "12px 14px" }}>Monto</th>
                  <th style={{ padding: "12px 14px" }}>Método</th>
                  <th style={{ padding: "12px 14px" }}>Proveedor / Personal</th>
                  <th style={{ padding: "12px 14px" }}>Estado</th>
                  {isAdmin && <th style={{ padding: "12px 14px", textAlign: "right" }}>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((ex) => {
                  const isVoided = ex.status === "voided";
                  const isBeingVoided = voidingExpenseId === ex.id;

                  return (
                    <tr
                      key={ex.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        opacity: isVoided ? 0.6 : 1,
                        background: isVoided ? "rgba(107,114,128,0.03)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>{ex.expense_date}</td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span className="badge badge-neutral" style={{ fontSize: "0.72rem" }}>
                          {EXPENSE_CATEGORY_ICONS[ex.category]} {ex.category}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <strong>{ex.description}</strong>
                        {ex.notes && (
                          <p style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", margin: "2px 0 0" }}>
                            📝 {ex.notes}
                          </p>
                        )}
                        {isVoided && ex.void_reason && (
                          <p style={{ fontSize: "0.72rem", color: "#ef4444", margin: "4px 0 0" }}>
                            🚫 Anulado: {ex.void_reason}
                          </p>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: isVoided ? "var(--color-text-muted)" : "#ef4444", whiteSpace: "nowrap" }}>
                        S/ {(ex.amount_cents / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {EXPENSE_PAYMENT_METHOD_LABELS[ex.payment_method] || ex.payment_method}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: "0.78rem", color: "var(--color-text-muted)" }}>
                        {ex.supplier && <span>🏢 {ex.supplier}</span>}
                        {ex.employee_name && <span> · 👤 {ex.employee_name}</span>}
                        {!ex.supplier && !ex.employee_name && "—"}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span className={`badge ${isVoided ? "badge-error" : "badge-success"}`} style={{ fontSize: "0.68rem" }}>
                          {isVoided ? "Anulado" : "Activo"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {!isVoided && !isBeingVoided && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingExpenseId(ex.id);
                                setVoidReason("");
                                setVoidError(null);
                              }}
                              className="btn btn-ghost btn-sm"
                              style={{ color: "#ef4444", fontSize: "0.72rem", padding: "2px 8px" }}
                            >
                              🚫 Anular
                            </button>
                          )}

                          {isBeingVoided && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                              <input
                                type="text"
                                className="input"
                                placeholder="Motivo de anulación..."
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                style={{ fontSize: "0.75rem", padding: "4px 8px", width: 180 }}
                              />
                              {voidError && (
                                <span style={{ fontSize: "0.68rem", color: "#ef4444" }}>{voidError}</span>
                              )}
                              <div style={{ display: "flex", gap: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => setVoidingExpenseId(null)}
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleVoidExpense(ex.id)}
                                  disabled={voidLoading}
                                  className="btn btn-sm"
                                  style={{ background: "#ef4444", color: "#fff", border: "none", fontSize: "0.7rem", padding: "2px 8px" }}
                                >
                                  {voidLoading ? "..." : "Confirmar"}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Creación de Egreso */}
      {isCreateModalOpen && (
        <ExpenseFormModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchExpenses();
          }}
        />
      )}
    </div>
  );
}
