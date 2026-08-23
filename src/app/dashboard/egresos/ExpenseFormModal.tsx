"use client";

import { useState, useEffect } from "react";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
  type ExpensePaymentMethod,
} from "@/lib/types/expenses";

interface EmployeeOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface ExpenseFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ExpenseFormModal({ onClose, onSuccess }: ExpenseFormModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState<ExpenseCategory>("Insumos");
  const [description, setDescription] = useState("");
  const [amountSoles, setAmountSoles] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("cash");
  const [supplier, setSupplier] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar lista de empleados para relacionar gastos de personal/comisiones
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await fetch("/api/admin/employees");
        if (res.ok) {
          const data = await res.json();
          if (data.employees) {
            setEmployees(data.employees);
          }
        }
      } catch (err) {
        console.error("Error loading employees for expense form:", err);
      }
    }
    loadEmployees();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valAmount = parseFloat(amountSoles);
    if (isNaN(valAmount) || valAmount <= 0) {
      setError("Ingresa un monto válido mayor a cero.");
      return;
    }

    if (!description.trim() || description.trim().length < 3) {
      setError("Ingresa una descripción clara del gasto (mínimo 3 caracteres).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: expenseDate,
          category,
          description: description.trim(),
          amount_cents: Math.round(valAmount * 100),
          payment_method: paymentMethod,
          supplier: supplier.trim() || undefined,
          employee_id: employeeId || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo registrar el egreso.");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Error de conexión al registrar el egreso.");
    } finally {
      setLoading(false);
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
      aria-label="Registrar Nuevo Egreso"
    >
      <div
        className="card card-gold"
        style={{
          width: "100%",
          maxWidth: 520,
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
              💸 Registrar Nuevo Egreso
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              Ingresa el detalle del gasto operativo o compra del negocio
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Fecha y Categoría */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" htmlFor="expense-date">
                Fecha del Gasto
              </label>
              <input
                id="expense-date"
                type="date"
                className="input"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label className="label" htmlFor="expense-category">
                Categoría
              </label>
              <select
                id="expense-category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                style={{ width: "100%" }}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="label" htmlFor="expense-desc">
              Descripción del Gasto
            </label>
            <input
              id="expense-desc"
              type="text"
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Compra de toallas y champú para barbería"
              required
              style={{ width: "100%" }}
            />
          </div>

          {/* Monto y Método de Pago */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" htmlFor="expense-amount">
                Monto en Soles (S/)
              </label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.10"
                className="input"
                value={amountSoles}
                onChange={(e) => setAmountSoles(e.target.value)}
                placeholder="0.00"
                required
                style={{ width: "100%", fontWeight: 700, color: "#ef4444" }}
              />
            </div>

            <div>
              <label className="label" htmlFor="expense-method">
                Método de Pago
              </label>
              <select
                id="expense-method"
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                style={{ width: "100%" }}
              >
                {Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Proveedor y Empleado relacionado */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" htmlFor="expense-supplier">
                Proveedor / Destinatario (Opcional)
              </label>
              <input
                id="expense-supplier"
                type="text"
                className="input"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej: Distribuidora Barber SAC"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label className="label" htmlFor="expense-employee">
                Personal Relacionado (Opcional)
              </label>
              <select
                id="expense-employee"
                className="input"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">Ninguno / General</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="label" htmlFor="expense-notes">
              Notas u Observaciones (Opcional)
            </label>
            <textarea
              id="expense-notes"
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Número de factura o comprobante físico..."
              style={{ width: "100%", resize: "vertical", fontSize: "0.82rem" }}
            />
          </div>

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.8rem" }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={loading} style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
              {loading ? "Guardando..." : "Guardar Egreso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
