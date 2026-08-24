/**
 * Tipos TypeScript para el Módulo de Calendario por Empleado.
 */

export type CalendarEventType = "booking" | "permission";

export const CALENDAR_EVENT_CONFIG: Record<
  CalendarEventType,
  { label: string; icon: string; color: string; bgColor: string; borderColor: string }
> = {
  booking: {
    label: "Reserva",
    icon: "📅",
    color: "#38bdf8",
    bgColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
  },
  permission: {
    label: "Permiso / Ausencia",
    icon: "🟡",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
};

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  employee_id: string;
  employee_name: string;
  employee_specialty?: string;
  date: string;
  end_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  status_label: string;
  badge_class: string;
  icon: string;
  color: string;
  bg_color: string;
  border_color: string;
  description?: string;
  details: {
    booking_code?: string;
    client_name?: string;
    client_phone?: string;
    services?: string[];
    price_cents?: number;
    payment_status?: string;
    permission_type?: string;
    reason?: string;
    observation?: string;
    evidence_url?: string | null;
  };
}

export type CalendarViewMode = "day" | "week" | "month";
