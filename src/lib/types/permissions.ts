/**
 * Tipos TypeScript para el Sistema de Permisos por Rango y Bloqueos de Personal.
 */

export type PermissionType =
  | "vacaciones"
  | "medico"
  | "personal"
  | "capacitacion"
  | "maternidad_paternidad"
  | "otro";

export const PERMISSION_TYPE_LABELS: Record<PermissionType, { label: string; icon: string }> = {
  vacaciones: { label: "Vacaciones", icon: "🏖️" },
  medico: { label: "Cita Médica / Salud", icon: "🩺" },
  personal: { label: "Asunto Personal", icon: "👤" },
  capacitacion: { label: "Capacitación / Taller", icon: "📚" },
  maternidad_paternidad: { label: "Maternidad / Paternidad", icon: "🍼" },
  otro: { label: "Otro Motivo", icon: "📋" },
};

export type PermissionStatus = "pending" | "approved" | "rejected" | "cancelled";

export const PERMISSION_STATUS_LABELS: Record<PermissionStatus, { label: string; badgeClass: string; icon: string }> = {
  pending: { label: "Pendiente", badgeClass: "badge-warning", icon: "⏳" },
  approved: { label: "Aprobado", badgeClass: "badge-success", icon: "✅" },
  rejected: { label: "Rechazado", badgeClass: "badge-error", icon: "❌" },
  cancelled: { label: "Anulado", badgeClass: "badge-neutral", icon: "⚪" },
};

export interface PermissionAuditEntry {
  action: string;
  user_id: string;
  user_name?: string;
  timestamp: string;
  details?: string;
}

export interface EmployeePermission {
  id: string;
  employee_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string;
  block_date?: string; // Legacy
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  permission_type: PermissionType;
  reason: string;
  observation: string | null;
  evidence_url: string | null;
  status: PermissionStatus;
  registered_by: string | null;
  registered_by_name?: string;
  approved_by: string | null;
  approved_by_name?: string;
  approved_at: string | null;
  audit_history: PermissionAuditEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface ConflictingBooking {
  id: string;
  booking_code: string;
  client_name: string;
  client_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price_cents: number;
  services: string[];
}
