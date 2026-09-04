import { createClient } from "@/lib/supabase/server";
import { DashboardHome, FinancialBooking, FinancialVenta } from "./DashboardHome";
import { Egreso } from "@/lib/types/expense";

export const metadata = {
  title: "Inicio — Panel Acicalados",
};

function getPeruDateString(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fecha actual en Zona Horaria Perú (America/Lima, UTC-5)
  const now = new Date();
  const today = getPeruDateString(now);

  // Calcular inicio de semana (Lunes) y de mes en Perú
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const dayOfWeek = dt.getDay(); // 0 = Domingo, 1 = Lunes
  const diffToMonday = dt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const mondayDate = new Date(y, m - 1, diffToMonday, 12, 0, 0);
  const weekStartStr = getPeruDateString(mondayDate);

  const sundayDate = new Date(y, m - 1, diffToMonday + 6, 12, 0, 0);
  const weekEndStr = getPeruDateString(sundayDate);

  // Cargar reservas del día de hoy (para agenda operativa)
  const { data: todayBookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
    )
    .eq("booking_date", today)
    .in("status", ["confirmada", "completada", "pendiente"])
    .order("start_time");

  // Conteo de reservas confirmadas de esta semana
  const { count: weekCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .gte("booking_date", weekStartStr)
    .lte("booking_date", weekEndStr)
    .in("status", ["confirmada", "completada"]);

  // Cargar reservas activas y confirmadas para el consolidado financiero (unificadas con Reservas)
  const { data: financialBookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_first_name, client_last_name, start_time, status, payment_status, service_type, booking_date, total_price_cents, advance_amount_cents, balance_cents, created_at"
    )
    .in("status", ["confirmada", "completada", "pendiente"])
    .order("booking_date", { ascending: false })
    .limit(200);

  // Cargar egresos y ventas de mostrador en paralelo
  const [expensesRes, egresosRes, ventasRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(200),
    supabase
      .from("egresos")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(200),
    supabase
      .from("ventas_mostrador")
      .select("id, cliente_nombre, producto_nombre, cantidad, precio_unitario, total, metodo_pago, fecha, notas")
      .order("fecha", { ascending: false })
      .limit(300),
  ]);

  const rawExpenses = expensesRes.data || [];
  const rawEgresos = egresosRes.data || [];
  const rawVentas = ventasRes.data || [];

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
      initialFinancialBookings={(financialBookings as unknown as FinancialBooking[]) ?? []}
      initialFinancialEgresos={combinedEgresos}
      initialFinancialVentas={(rawVentas as unknown as FinancialVenta[]) ?? []}
    />
  );
}
