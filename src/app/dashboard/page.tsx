import { createClient } from "@/lib/supabase/server";
import { DashboardHome, FinancialBooking } from "./DashboardHome";
import { Egreso } from "@/lib/types/expense";

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

  // Inicio de mes actual (para panel consolidado financiero inicial)
  const monthStartStr = `${year}-${month}-01`;

  // Cargar reservas del día de hoy (para agenda)
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
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

  // Cargar reservas de este mes para el consolidado financiero
  const { data: monthBookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
    )
    .gte("booking_date", monthStartStr)
    .order("booking_date", { ascending: false });

  // Cargar egresos de este mes (consultando expenses y egresos)
  const [expensesRes, egresosRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", monthStartStr)
      .order("expense_date", { ascending: false }),
    supabase
      .from("egresos")
      .select("*")
      .gte("expense_date", monthStartStr)
      .order("expense_date", { ascending: false }),
  ]);

  const rawExpenses = expensesRes.data || [];
  const rawEgresos = egresosRes.data || [];

  // Mapear y unificar egresos activos
  const combinedEgresos: Egreso[] = [
    ...rawExpenses
      .filter((e) => e.status !== "voided")
      .map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount_cents: e.amount_cents,
        currency: "PEN",
        expense_date: e.expense_date,
        payment_method: e.payment_method,
        receipt_type: e.receipt_url ? "comprobante" : "ninguno",
        receipt_number: null,
        supplier: e.supplier || null,
        notes: e.notes || null,
        created_at: e.created_at,
        updated_at: e.created_at,
      })),
    ...rawEgresos.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount_cents: e.amount_cents,
      currency: e.currency || "PEN",
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      receipt_type: e.receipt_type,
      receipt_number: e.receipt_number,
      supplier: e.supplier,
      notes: e.notes,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })),
  ];

  return (
    <DashboardHome
      initialBookings={(todayBookings as unknown as FinancialBooking[]) ?? []}
      initialWeekCount={weekCount ?? 0}
      initialFinancialBookings={(monthBookings as unknown as FinancialBooking[]) ?? []}
      initialFinancialEgresos={combinedEgresos}
    />
  );
}
