/**
 * Tipos TypeScript para el Sistema de Justificaciones y Bonificaciones de Asistencia.
 */

export type JustificationType = "check_in" | "check_out" | "absence";

export const JUSTIFICATION_TYPE_LABELS: Record<JustificationType, string> = {
  check_in: "Entrada Tardía 🟡",
  check_out: "Salida Anticipada 🟠",
  absence: "Ausencia / Falta 🔴",
};

export type JustificationStatus = "pending" | "approved" | "rejected";

export const JUSTIFICATION_STATUS_LABELS: Record<JustificationStatus, string> = {
  pending: "Pendiente de Aprobación ⏳",
  approved: "Aprobada ✅",
  rejected: "Rechazada ❌",
};

export const JUSTIFICATION_STATUS_BADGE: Record<JustificationStatus, string> = {
  pending: "badge-warning",
  approved: "badge-success",
  rejected: "badge-error",
};

export interface JustificationAuditEntry {
  action: string;
  user_id: string;
  user_name?: string;
  timestamp: string;
  details?: string;
}

export interface AttendanceJustification {
  id: string;
  attendance_id: string | null;
  employee_id: string;
  employee_name?: string;
  type: JustificationType;
  reason: string;
  observation: string | null;
  evidence_url: string | null;
  status: JustificationStatus;
  registered_by: string | null;
  registered_by_name?: string;
  approved_by: string | null;
  approved_by_name?: string;
  approved_at: string | null;
  audit_history: JustificationAuditEntry[];
  created_at: string;
  updated_at: string;
}

export type RoundingMethod = "none" | "nearest_5" | "floor_5";

export interface BonusRule {
  id: number;
  day_of_week: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado
  day_name: string;
  bonus_start_time: string; // "21:10:00" o "20:10:00"
  is_active: boolean;
  rounding_method: RoundingMethod;
  effective_from: string;
  effective_to: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

export const DEFAULT_BONUS_RULES: BonusRule[] = [
  { id: 0, day_of_week: 0, day_name: "Domingo", bonus_start_time: "20:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 1, day_of_week: 1, day_name: "Lunes", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 2, day_of_week: 2, day_name: "Martes", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 3, day_of_week: 3, day_name: "Miércoles", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 4, day_of_week: 4, day_name: "Jueves", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 5, day_of_week: 5, day_name: "Viernes", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
  { id: 6, day_of_week: 6, day_name: "Sábado", bonus_start_time: "21:10:00", is_active: true, rounding_method: "none", effective_from: "2026-01-01", effective_to: null },
];

export interface BonusCalculationResult {
  bonus_minutes: number;
  bonus_hours: number;
  rule_applied: string;
  bonus_start_time: string;
  is_eligible: boolean;
}
