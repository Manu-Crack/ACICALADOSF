import { createClient } from "@/lib/supabase/server";
import { DashboardHome, TodayBooking } from "./DashboardHome";

export const metadata = {
  title: "Inicio — Panel Acicalados",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fecha local de hoy en formato YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  // Cargar reservas del día de hoy
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date"
    )
    .eq("booking_date", today)
    .in("status", ["confirmada", "completada", "pendiente"])
    .order("start_time");

  // Conteo de reservas de esta semana
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const wsYear = weekStart.getFullYear();
  const wsMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
  const wsDay = String(weekStart.getDate()).padStart(2, "0");
  const weekStartStr = `${wsYear}-${wsMonth}-${wsDay}`;

  const { count: weekCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .gte("booking_date", weekStartStr)
    .in("status", ["confirmada", "completada"]);

  return (
    <DashboardHome
      initialBookings={(todayBookings as unknown as TodayBooking[]) ?? []}
      initialWeekCount={weekCount ?? 0}
    />
  );
}

