/**
 * Tipos TypeScript para el Sistema de Reportes Financieros y Operativos.
 */

import type { Expense } from "./expenses";

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  bookingStatus?: string;
  paymentStatus?: string;
  employeeId?: string;
  serviceId?: string;
  paymentMethod?: string;
  searchTerm?: string;
}

export interface FinancialSummary {
  // Cantidad de reservas
  total_bookings: number;
  pending_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;

  // Segmentación por rubro operativo (Spa vs Barbería)
  spa_collected_cents: number;
  barberia_collected_cents: number;
  spa_bookings_count: number;
  barberia_bookings_count: number;

  // 1. Valor contratado de reservas (Pactado)
  total_services_value_cents: number;

  // 2. Ingresos realmente cobrados (Pagos verificados + Ventas de mostrador)
  total_collected_cents: number;
  yape_collected_cents: number;
  cash_collected_cents: number;
  transfer_collected_cents: number;
  mixed_collected_cents: number;
  culqi_collected_cents: number; // Pagos históricos verificados de Culqi

  // Ventas de mostrador (Productos físicos)
  counter_sales_collected_cents?: number;
  counter_sales_count?: number;

  // 3. Adelantos cobrados
  advances_collected_cents: number;

  // 4. Saldos pendientes en reservas activas
  pending_balance_cents: number;

  // 5. Egresos operativos totales (Gastos activos)
  total_expenses_cents: number;

  // 6. Resultado Neto (Ingresos cobrados - Egresos)
  net_result_cents: number;
}

export interface BookingReportItem {
  id: string;
  booking_code: string;
  client_name: string;
  client_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  employee_id: string | null;
  employee_name: string;
  service_names: string;
  service_type: string;
  total_price_cents: number;
  advance_percentage: number;
  advance_required_cents: number;
  advance_amount_cents: number;
  balance_cents: number;
  booking_status: string;
  payment_status: string;
  confirmed_at: string | null;
  last_payment_method: string | null;
  yape_paid_cents: number;
  cash_paid_cents: number;
  verified_by_name: string | null;
  created_at: string;
}

export interface PaymentReportItem {
  id: string;
  booking_id: string;
  booking_code: string;
  client_name: string;
  amount_cents: number;
  payment_method: string;
  payment_type: string;
  yape_amount_cents: number;
  cash_amount_cents: number;
  status: string;
  notes: string | null;
  proof_url: string | null;
  paid_at: string;
  registered_by_name: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
}

export interface ServicePerformanceItem {
  service_id: string;
  service_name: string;
  service_type: string;
  price_cents: number;
  duration_minutes: number;
  times_booked: number;
  total_revenue_cents: number;
}

export interface EmployeePerformanceItem {
  employee_id: string;
  employee_name: string;
  position: string;
  bookings_count: number;
  completed_count: number;
  total_revenue_collected_cents: number;
  total_duration_minutes?: number;
}

export interface CompletedServiceAuditItem {
  id: string;
  booking_id: string;
  booking_code: string;
  client_name: string;
  service_name: string;
  service_type: "spa" | "barberia" | "mixto" | string;
  price_cents: number;
  employee_name: string;
  date_exact: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
}

export interface CounterSaleReportItem {
  id: string;
  cliente_nombre: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  total_cents: number;
  metodo_pago: string;
  fecha: string;
  registrado_por?: string | null;
  notas?: string | null;
}

export interface FullReportData {
  filters: ReportFilterParams;
  generated_at: string;
  generated_by_name: string;
  summary: FinancialSummary;
  bookings: BookingReportItem[];
  payments: PaymentReportItem[];
  services_breakdown: ServicePerformanceItem[];
  employees_breakdown: EmployeePerformanceItem[];
  expenses: Expense[];
  completed_services_audit?: CompletedServiceAuditItem[];
  counter_sales?: CounterSaleReportItem[];
}
