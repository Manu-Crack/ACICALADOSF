export type ExpenseCategory =
  | "insumos"
  | "servicios_basicos"
  | "mantenimiento"
  | "sueldos"
  | "alquiler"
  | "marketing"
  | "impuestos"
  | "equipamiento"
  | "otros";

export type ExpensePaymentMethod =
  | "efectivo"
  | "transferencia"
  | "tarjeta"
  | "yape"
  | "plin"
  | "otro";

export type ExpenseReceiptType =
  | "ninguno"
  | "boleta"
  | "factura"
  | "ticket"
  | "recibo";

export interface Egreso {
  id: string;
  description: string;
  category: ExpenseCategory | string;
  amount_cents: number;
  currency: string;
  expense_date: string; // YYYY-MM-DD
  payment_method: ExpensePaymentMethod | string;
  receipt_type: ExpenseReceiptType | string;
  receipt_number: string | null;
  supplier: string | null;
  notes: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EgresoFormData {
  description: string;
  category: string;
  amount_soles: number | string;
  expense_date: string;
  payment_method: string;
  receipt_type: string;
  receipt_number?: string;
  supplier?: string;
  notes?: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string; color: string }[] = [
  { value: "insumos", label: "Insumos & Productos", icon: "🧴", color: "#38bdf8" },
  { value: "servicios_basicos", label: "Servicios Básicos (Luz/Agua/Internet)", icon: "💡", color: "#fbbf24" },
  { value: "sueldos", label: "Sueldos & Comisiones", icon: "👥", color: "#4ade80" },
  { value: "alquiler", label: "Alquiler de Local", icon: "🏢", color: "#a78bfa" },
  { value: "mantenimiento", label: "Mantenimiento & Reparación", icon: "🔧", color: "#f87171" },
  { value: "marketing", label: "Marketing & Publicidad", icon: "📣", color: "#f472b6" },
  { value: "equipamiento", label: "Equipamiento & Mobiliario", icon: "🪑", color: "#fb923c" },
  { value: "impuestos", label: "Impuestos & Contabilidad", icon: "📑", color: "#94a3b8" },
  { value: "otros", label: "Otros Egresos", icon: "📦", color: "#cbd5e1" },
];

export const EXPENSE_PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia Bancaria" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta", label: "Tarjeta Débito/Crédito" },
  { value: "otro", label: "Otro Método" },
];

export const EXPENSE_RECEIPT_TYPES: { value: ExpenseReceiptType; label: string }[] = [
  { value: "ninguno", label: "Sin comprobante" },
  { value: "boleta", label: "Boleta de Venta" },
  { value: "factura", label: "Factura" },
  { value: "ticket", label: "Ticket" },
  { value: "recibo", label: "Recibo Simple" },
];

export function formatCentsToSoles(cents: number): string {
  const soles = (cents || 0) / 100;
  return `S/ ${soles.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getCategoryInfo(category: string) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category) || {
      value: category,
      label: category || "Otros",
      icon: "📦",
      color: "#cbd5e1",
    }
  );
}
