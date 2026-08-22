/**
 * Tipos TypeScript para el Módulo de Egresos y Gastos Operativos.
 */

export type ExpenseCategory =
  | "Insumos"
  | "Productos"
  | "Servicios básicos"
  | "Mantenimiento"
  | "Personal"
  | "Transporte"
  | "Otros";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Insumos",
  "Productos",
  "Servicios básicos",
  "Mantenimiento",
  "Personal",
  "Transporte",
  "Otros",
];

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  "Insumos": "🧴",
  "Productos": "🛍️",
  "Servicios básicos": "💡",
  "Mantenimiento": "🔧",
  "Personal": "👥",
  "Transporte": "🚗",
  "Otros": "📦",
};

export type ExpensePaymentMethod = "yape" | "cash" | "card" | "transfer" | "other";

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: "Efectivo 💵",
  yape: "Yape 💜",
  card: "Tarjeta 💳",
  transfer: "Transferencia 🏦",
  other: "Otro",
};

export type ExpenseStatus = "active" | "voided";

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  payment_method: ExpensePaymentMethod;
  receipt_url: string | null;
  employee_id: string | null;
  employee_name?: string;
  supplier: string | null;
  notes: string | null;
  registered_by: string | null;
  registered_by_name?: string;
  status: ExpenseStatus;
  voided_at: string | null;
  voided_by: string | null;
  voided_by_name?: string;
  void_reason: string | null;
  created_at: string;
}

export interface CreateExpensePayload {
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  payment_method: ExpensePaymentMethod;
  receipt_url?: string | null;
  employee_id?: string | null;
  supplier?: string | null;
  notes?: string | null;
}
