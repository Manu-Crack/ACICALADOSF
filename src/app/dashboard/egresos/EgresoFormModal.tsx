"use client";

import { useState, useEffect } from "react";
import {
  Egreso,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_RECEIPT_TYPES,
} from "@/lib/types/expense";

interface EgresoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedEgreso: Egreso) => void;
  egresoToEdit?: Egreso | null;
}

export function EgresoFormModal({
  isOpen,
  onClose,
  onSaved,
  egresoToEdit,
}: EgresoFormModalProps) {
  const isEditing = Boolean(egresoToEdit);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("insumos");
  const [amountSoles, setAmountSoles] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [receiptType, setReceiptType] = useState("ninguno");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Initialize or reset fields
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      if (egresoToEdit) {
        setDescription(egresoToEdit.description || "");
        setCategory(egresoToEdit.category || "insumos");
        setAmountSoles(((egresoToEdit.amount_cents || 0) / 100).toFixed(2));
        setExpenseDate(
          egresoToEdit.expense_date || new Date().toISOString().split("T")[0]
        );
        setPaymentMethod(egresoToEdit.payment_method || "efectivo");
        setReceiptType(egresoToEdit.receipt_type || "ninguno");
        setReceiptNumber(egresoToEdit.receipt_number || "");
        setSupplier(egresoToEdit.supplier || "");
        setNotes(egresoToEdit.notes || "");
      } else {
        setDescription("");
        setCategory("insumos");
        setAmountSoles("");
        setExpenseDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod("efectivo");
        setReceiptType("ninguno");
        setReceiptNumber("");
        setSupplier("");
        setNotes("");
      }
    }
  }, [isOpen, egresoToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!description.trim()) {
      setErrorMsg("Por favor, ingresa una descripción para el egreso.");
      return;
    }

    const numSoles = parseFloat(amountSoles);
    if (isNaN(numSoles) || numSoles <= 0) {
      setErrorMsg("Por favor, ingresa un monto válido mayor a 0.");
      return;
    }

    const amount_cents = Math.round(numSoles * 100);

    try {
      setSaving(true);
      const payload = {
        description: description.trim(),
        category,
        amount_cents,
        expense_date: expenseDate,
        payment_method: paymentMethod,
        receipt_type: receiptType,
        receipt_number: receiptNumber.trim() || null,
        supplier: supplier.trim() || null,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/admin/egresos", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEditing ? { id: egresoToEdit?.id, ...payload } : payload
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al procesar el egreso");
      }

      onSaved(data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "92vh",
          overflowY: "auto",
          backgroundColor: "#141414",
          border: "1px solid rgba(200, 164, 92, 0.35)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.7)",
          padding: "28px",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            borderBottom: "1px solid var(--color-border)",
            paddingBottom: 16,
          }}
        >
          <div>
            <h2
              className="heading-md"
              style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}
            >
              <span>{isEditing ? "✏️ Editar Egreso" : "💸 Registrar Nuevo Egreso"}</span>
            </h2>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
              {isEditing
                ? "Modifica los detalles del egreso seleccionado."
                : "Registra los gastos operativos, compras o pagos del negocio."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: "1rem",
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              color: "#f87171",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              fontSize: "0.875rem",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Row: Descripción */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 6,
              }}
            >
              Descripción del Egreso <span style={{ color: "var(--color-error)" }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Compra de champús, Pago de luz del local, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "#0A0A0A",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Row: Monto & Fecha */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                Monto en Soles (S/) <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-primary)",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  S/
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amountSoles}
                  onChange={(e) => setAmountSoles(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    borderRadius: "var(--radius-md)",
                    background: "#0A0A0A",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                Fecha del Gasto <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "#0A0A0A",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                }}
              />
            </div>
          </div>

          {/* Row: Categoría & Método de Pago */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "#0A0A0A",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                }}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "#0A0A0A",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                }}
              >
                {EXPENSE_PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: Proveedor */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 6,
              }}
            >
              Proveedor o Beneficiario
            </label>
            <input
              type="text"
              placeholder="Ej: Distribuidora Belleza SAC, Enel, Sedapal..."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "#0A0A0A",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "0.9rem",
              }}
            />
          </div>

          {/* Row: Tipo de Comprobante & Número */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                Tipo de Comprobante
              </label>
              <select
                value={receiptType}
                onChange={(e) => setReceiptType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "#0A0A0A",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                }}
              >
                {EXPENSE_RECEIPT_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                  marginBottom: 6,
                }}
              >
                N° de Comprobante
              </label>
              <input
                type="text"
                placeholder="Ej: B001-000492"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "#0A0A0A",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "0.9rem",
                }}
              />
            </div>
          </div>

          {/* Row: Notas */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--color-text)",
                marginBottom: 6,
              }}
            >
              Notas Adicionales (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Detalles sobre el gasto, observaciones o justificación..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: "#0A0A0A",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                fontSize: "0.9rem",
                resize: "vertical",
              }}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 10,
              borderTop: "1px solid var(--color-border)",
              paddingTop: 16,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin"
                    style={{ width: 16, height: 16 }}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      style={{ opacity: 0.25 }}
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      style={{ opacity: 0.75 }}
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? "Guardar Cambios" : "Registrar Egreso"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
