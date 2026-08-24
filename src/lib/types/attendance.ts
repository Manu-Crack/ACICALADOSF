/**
 * Constantes y tipos estandarizados para el módulo de Asistencia
 * Coincide carácter por carácter con el check constraint de Supabase:
 * CHECK ((status = ANY (ARRAY['presente'::text, 'tardanza'::text, 'salida_temprana'::text, 'falta_justificada'::text, 'falta_injustificada'::text])))
 */

export type AttendanceStatus =
  | "presente"
  | "tardanza"
  | "salida_temprana"
  | "falta_justificada"
  | "falta_injustificada"
  | "en_permiso";

export const ATTENDANCE_STATUS = {
  PRESENTE: "presente",
  TARDANZA: "tardanza",
  SALIDA_TEMPRANA: "salida_temprana",
  FALTA_JUSTIFICADA: "falta_justificada",
  FALTA_INJUSTIFICADA: "falta_injustificada",
  EN_PERMISO: "en_permiso",
} as const;

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  status: AttendanceStatus | string;
  notes: string | null;
  entry_justification?: string | null;
  exit_justification?: string | null;
  bonus_minutes?: number;
  bonus_calculation_type?: "auto" | "manual";
  bonus_adjusted_by?: string | null;
  bonus_adjusted_at?: string | null;
  bonus_adjustment_reason?: string | null;
  check_in_justified?: boolean;
  check_out_justified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function getAttendanceStatusInfo(
  status: string | null | undefined,
  entryJustification?: string | null,
  exitJustification?: string | null
): {
  label: string;
  badgeClass: string;
  icon: string;
  isJustified: boolean;
} {
  const normalized = (status || "").toLowerCase().trim();
  const hasEntryJust = Boolean(entryJustification && entryJustification.trim());
  const hasExitJust = Boolean(exitJustification && exitJustification.trim());

  switch (normalized) {
    case "presente":
      return { label: "Presente (A tiempo)", badgeClass: "badge-success", icon: "🟢", isJustified: false };
    case "en_permiso":
      return { label: "En Permiso Temporal", badgeClass: "badge-warning", icon: "⏸️", isJustified: true };
    case "tardanza":
      if (hasEntryJust) {
        return { label: "Tardanza (Justificada)", badgeClass: "badge-warning", icon: "🟡", isJustified: true };
      }
      return { label: "Tardanza", badgeClass: "badge-warning", icon: "🟡", isJustified: false };
    case "salida_temprana":
      if (hasExitJust) {
        return { label: "Salida Temprana (Justificada)", badgeClass: "badge-warning", icon: "🟠", isJustified: true };
      }
      return { label: "Salida Temprana", badgeClass: "badge-warning", icon: "🟠", isJustified: false };
    case "falta_justificada":
      return { label: "Falta Justificada", badgeClass: "badge-warning", icon: "🟡", isJustified: true };
    case "falta_injustificada":
      return { label: "Falta Injustificada", badgeClass: "badge-error", icon: "🔴", isJustified: false };
    default:
      return { label: status || "Presente", badgeClass: "badge-success", icon: "🟢", isJustified: false };
  }
}
