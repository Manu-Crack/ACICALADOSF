import { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportFilterParams,
  FullReportData,
  FinancialSummary,
  BookingReportItem,
  PaymentReportItem,
  ServicePerformanceItem,
  EmployeePerformanceItem,
  CompletedServiceAuditItem,
} from "@/lib/types/reports";
import type { Expense } from "@/lib/types/expenses";

/**
 * Servicio Centralizado de Reportes Financieros y Operativos.
 * Realiza cálculos exactos respetando las reglas financieras y de segmentación de rubros.
 */
export async function buildFullReportData(
  supabase: SupabaseClient,
  filters: ReportFilterParams,
  generatedByName: string
): Promise<FullReportData> {
  const {
    startDate,
    endDate,
    bookingStatus,
    paymentStatus,
    employeeId,
    paymentMethod,
    searchTerm,
  } = filters;

  // ---------------------------------------------------------------------------
  // 1. Consultar Reservas dentro del Rango
  // ---------------------------------------------------------------------------
  let bookingsQuery = supabase
    .from("bookings")
    .select(`
      id,
      booking_code,
      client_first_name,
      client_last_name,
      client_phone,
      booking_date,
      start_time,
      end_time,
      status,
      payment_status,
      service_type,
      payment_method,
      total_price_cents,
      advance_percentage,
      advance_amount_cents,
      balance_cents,
      confirmed_at,
      assigned_employee_id,
      created_at,
      employees:assigned_employee_id (id, first_name, last_name, position),
      booking_services (
        service_id,
        price_cents,
        duration_minutes,
        services:service_id (name, type)
      )
    `)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (startDate) {
    bookingsQuery = bookingsQuery.gte("booking_date", startDate);
  }
  if (endDate) {
    bookingsQuery = bookingsQuery.lte("booking_date", endDate);
  }
  if (bookingStatus && bookingStatus !== "all") {
    bookingsQuery = bookingsQuery.eq("status", bookingStatus);
  }
  if (paymentStatus && paymentStatus !== "all") {
    bookingsQuery = bookingsQuery.eq("payment_status", paymentStatus);
  }
  if (employeeId && employeeId !== "all") {
    bookingsQuery = bookingsQuery.eq("assigned_employee_id", employeeId);
  }

  const { data: rawBookings, error: bookingsErr } = await bookingsQuery;
  if (bookingsErr) {
    console.error("Error fetching bookings for report:", bookingsErr);
    throw new Error("No se pudieron cargar las reservas para el reporte.");
  }

  // ---------------------------------------------------------------------------
  // 2. Consultar Pagos Verificados y Anulados en el Rango
  // ---------------------------------------------------------------------------
  let paymentsQuery = supabase
    .from("payment_logs")
    .select(`
      id,
      booking_id,
      amount_cents,
      payment_method,
      payment_type,
      yape_amount_cents,
      cash_amount_cents,
      status,
      notes,
      proof_url,
      paid_at,
      registered_by,
      voided_at,
      voided_by,
      void_reason,
      bookings (booking_code, client_first_name, client_last_name, service_type)
    `)
    .order("paid_at", { ascending: false });

  if (startDate) {
    paymentsQuery = paymentsQuery.gte("paid_at", `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    paymentsQuery = paymentsQuery.lte("paid_at", `${endDate}T23:59:59.999Z`);
  }
  if (paymentMethod && paymentMethod !== "all") {
    paymentsQuery = paymentsQuery.eq("payment_method", paymentMethod);
  }

  const { data: rawPayments, error: paymentsErr } = await paymentsQuery;
  if (paymentsErr) {
    console.error("Error fetching payments for report:", paymentsErr);
  }

  // ---------------------------------------------------------------------------
  // 3. Consultar Egresos en el Rango
  // ---------------------------------------------------------------------------
  let expensesQuery = supabase
    .from("expenses")
    .select(`
      id,
      expense_date,
      category,
      description,
      amount_cents,
      payment_method,
      receipt_url,
      employee_id,
      supplier,
      notes,
      registered_by,
      status,
      voided_at,
      voided_by,
      void_reason,
      created_at,
      employees:employee_id (first_name, last_name)
    `)
    .order("expense_date", { ascending: false });

  if (startDate) {
    expensesQuery = expensesQuery.gte("expense_date", startDate);
  }
  if (endDate) {
    expensesQuery = expensesQuery.lte("expense_date", endDate);
  }

  const { data: rawExpenses, error: expensesErr } = await expensesQuery;
  if (expensesErr) {
    console.error("Error fetching expenses for report:", expensesErr);
  }

  // ---------------------------------------------------------------------------
  // 4. Mapear y procesar Pagos
  // ---------------------------------------------------------------------------
  interface RawPaymentRow {
    id: string;
    booking_id: string;
    amount_cents: number;
    payment_method: string;
    payment_type: string;
    yape_amount_cents: number | null;
    cash_amount_cents: number | null;
    status: string;
    notes: string | null;
    proof_url: string | null;
    paid_at: string;
    registered_by: string | null;
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    bookings: {
      booking_code: string;
      client_first_name: string | null;
      client_last_name: string | null;
      service_type?: string | null;
    } | null;
  }

  interface RawExpenseRow {
    id: string;
    expense_date: string;
    category: Expense["category"];
    description: string;
    amount_cents: number;
    payment_method: Expense["payment_method"];
    receipt_url: string | null;
    employee_id: string | null;
    supplier: string | null;
    notes: string | null;
    registered_by: string | null;
    status: Expense["status"];
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    created_at: string;
    employees: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  }

  interface RawBookingService {
    service_id: string;
    price_cents: number;
    duration_minutes: number;
    services: {
      name: string;
      type: string;
    } | null;
  }

  interface RawBookingRow {
    id: string;
    booking_code: string;
    client_first_name: string | null;
    client_last_name: string | null;
    client_phone: string | null;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
    payment_status: string;
    service_type: string;
    payment_method: string | null;
    total_price_cents: number;
    advance_percentage: number | null;
    advance_amount_cents: number | null;
    balance_cents: number | null;
    confirmed_at: string | null;
    assigned_employee_id: string | null;
    created_at: string;
    employees: {
      id: string;
      first_name: string;
      last_name: string;
      position: string;
    } | null;
    booking_services: RawBookingService[] | null;
  }

  const paymentsList: PaymentReportItem[] = [];
  let totalCollectedCents = 0;
  let yapeCollectedCents = 0;
  let cashCollectedCents = 0;
  let transferCollectedCents = 0;
  let mixedCollectedCents = 0;
  let culqiCollectedCents = 0;
  let advancesCollectedCents = 0;

  ((rawPayments || []) as unknown as RawPaymentRow[]).forEach((p) => {
    const isVerified = p.status === "verified";
    const clientName = p.bookings
      ? `${p.bookings.client_first_name || ""} ${p.bookings.client_last_name || ""}`.trim()
      : "Cliente";

    if (isVerified) {
      totalCollectedCents += p.amount_cents || 0;
      if (p.payment_method === "yape") {
        yapeCollectedCents += p.amount_cents || 0;
      } else if (p.payment_method === "cash" || p.payment_method === "efectivo") {
        cashCollectedCents += p.amount_cents || 0;
      } else if (p.payment_method === "transfer" || p.payment_method === "transferencia") {
        transferCollectedCents += p.amount_cents || 0;
      } else if (p.payment_method === "mixed" || p.payment_method === "mixto") {
        mixedCollectedCents += p.amount_cents || 0;
        yapeCollectedCents += p.yape_amount_cents || 0;
        cashCollectedCents += p.cash_amount_cents || 0;
      } else if (p.payment_method === "culqi_legacy") {
        culqiCollectedCents += p.amount_cents || 0;
      }

      if (p.payment_type === "advance" || p.payment_type === "partial") {
        advancesCollectedCents += p.amount_cents || 0;
      }
    }

    paymentsList.push({
      id: p.id,
      booking_id: p.booking_id,
      booking_code: p.bookings?.booking_code || "—",
      client_name: clientName,
      amount_cents: p.amount_cents,
      payment_method: p.payment_method,
      payment_type: p.payment_type,
      yape_amount_cents: p.yape_amount_cents || 0,
      cash_amount_cents: p.cash_amount_cents || 0,
      status: p.status,
      notes: p.notes,
      proof_url: p.proof_url,
      paid_at: p.paid_at,
      registered_by_name: null,
      voided_at: p.voided_at,
      voided_by_name: null,
      void_reason: p.void_reason,
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Mapear y procesar Egresos
  // ---------------------------------------------------------------------------
  const expensesList: Expense[] = [];
  let totalExpensesCents = 0;

  ((rawExpenses || []) as unknown as RawExpenseRow[]).forEach((ex) => {
    const isActive = ex.status === "active";
    if (isActive) {
      totalExpensesCents += ex.amount_cents || 0;
    }

    const employeeName = ex.employees
      ? `${ex.employees.first_name || ""} ${ex.employees.last_name || ""}`.trim()
      : undefined;

    expensesList.push({
      id: ex.id,
      expense_date: ex.expense_date,
      category: ex.category,
      description: ex.description,
      amount_cents: ex.amount_cents,
      payment_method: ex.payment_method,
      receipt_url: ex.receipt_url,
      employee_id: ex.employee_id,
      employee_name: employeeName,
      supplier: ex.supplier,
      notes: ex.notes,
      registered_by: ex.registered_by,
      status: ex.status,
      voided_at: ex.voided_at,
      voided_by: ex.voided_by,
      void_reason: ex.void_reason,
      created_at: ex.created_at,
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Mapear Reservas y Calcular Desgloses por Rubro (Spa vs Barbería)
  // ---------------------------------------------------------------------------
  const bookingsList: BookingReportItem[] = [];
  const completedServicesAuditList: CompletedServiceAuditItem[] = [];
  const servicesMap: Record<string, ServicePerformanceItem> = {};
  const employeesMap: Record<string, EmployeePerformanceItem> = {};

  let totalServicesValueCents = 0;
  let pendingBalanceCents = 0;
  let totalBookings = 0;
  let pendingBookings = 0;
  let confirmedBookings = 0;
  let completedBookings = 0;
  let cancelledBookings = 0;

  let spaCollectedCents = 0;
  let barberiaCollectedCents = 0;
  let spaBookingsCount = 0;
  let barberiaBookingsCount = 0;

  ((rawBookings || []) as unknown as RawBookingRow[]).forEach((b) => {
    // Filtro por búsqueda textual opcional
    const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim();
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesCode = b.booking_code?.toLowerCase().includes(term);
      const matchesClient = clientName.toLowerCase().includes(term);
      const matchesPhone = b.client_phone?.includes(term);
      if (!matchesCode && !matchesClient && !matchesPhone) {
        return;
      }
    }

    totalBookings++;

    if (b.status === "pendiente") pendingBookings++;
    else if (b.status === "confirmada") confirmedBookings++;
    else if (b.status === "completada") completedBookings++;
    else if (b.status === "cancelada" || b.status === "expirada") cancelledBookings++;

    totalServicesValueCents += b.total_price_cents || 0;

    // Solo sumamos el saldo pendiente en reservas que no estén canceladas ni expiradas
    if (b.status !== "cancelada" && b.status !== "expirada") {
      pendingBalanceCents += b.balance_cents || 0;
    }

    // Segmentación por rubro del dinero cobrado en esta reserva
    const bookingCollected = b.advance_amount_cents || 0;
    if (b.service_type === "spa") {
      spaBookingsCount++;
      spaCollectedCents += bookingCollected;
    } else if (b.service_type === "barberia") {
      barberiaBookingsCount++;
      barberiaCollectedCents += bookingCollected;
    } else {
      // Servicio mixto: calcular proporción de servicios spa vs barbería
      const bServices = b.booking_services || [];
      let spaSum = 0;
      let barberiaSum = 0;
      bServices.forEach((bs) => {
        const type = bs.services?.type || "barberia";
        if (type === "spa") spaSum += bs.price_cents || 0;
        else barberiaSum += bs.price_cents || 0;
      });
      const sumTotal = spaSum + barberiaSum || 1;
      const spaRatio = spaSum / sumTotal;
      spaCollectedCents += Math.round(bookingCollected * spaRatio);
      barberiaCollectedCents += Math.round(bookingCollected * (1 - spaRatio));
      if (spaSum > 0) spaBookingsCount++;
      if (barberiaSum > 0) barberiaBookingsCount++;
    }

    const employeeName = b.employees
      ? `${b.employees.first_name || ""} ${b.employees.last_name || ""}`.trim()
      : "Sin asignar";

    // Nombres de servicios y desglose de servicios
    const serviceNamesArr: string[] = [];
    const bServices = b.booking_services || [];

    if (bServices.length > 0) {
      bServices.forEach((bs) => {
        const sName = bs.services?.name || "Servicio";
        const sType = bs.services?.type || b.service_type || "barberia";
        serviceNamesArr.push(sName);

        // Desglose por servicio
        const key = bs.service_id || sName;
        if (!servicesMap[key]) {
          servicesMap[key] = {
            service_id: bs.service_id,
            service_name: sName,
            service_type: sType,
            price_cents: bs.price_cents || 0,
            duration_minutes: bs.duration_minutes || 30,
            times_booked: 0,
            total_revenue_cents: 0,
          };
        }
        servicesMap[key].times_booked += 1;
        servicesMap[key].total_revenue_cents += bs.price_cents || 0;

        // Agregar a la tabla de auditoría si la cita no está cancelada
        if (b.status !== "cancelada" && b.status !== "expirada") {
          completedServicesAuditList.push({
            id: `${b.id}_${bs.service_id}`,
            booking_id: b.id,
            booking_code: b.booking_code,
            client_name: clientName,
            service_name: sName,
            service_type: sType,
            price_cents: bs.price_cents || b.total_price_cents,
            employee_name: employeeName,
            date_exact: `${b.booking_date} ${b.start_time ? b.start_time.slice(0, 5) : ""}`.trim(),
            booking_date: b.booking_date,
            start_time: b.start_time,
            payment_method: b.payment_method || null,
            payment_status: b.payment_status,
            status: b.status,
          });
        }
      });
    } else {
      // Fallback si no hay booking_services desglosados
      const sName = b.service_type === "spa" ? "Servicio Spa" : "Servicio Barbería";
      serviceNamesArr.push(sName);

      if (b.status !== "cancelada" && b.status !== "expirada") {
        completedServicesAuditList.push({
          id: `${b.id}_main`,
          booking_id: b.id,
          booking_code: b.booking_code,
          client_name: clientName,
          service_name: sName,
          service_type: b.service_type || "barberia",
          price_cents: b.total_price_cents,
          employee_name: employeeName,
          date_exact: `${b.booking_date} ${b.start_time ? b.start_time.slice(0, 5) : ""}`.trim(),
          booking_date: b.booking_date,
          start_time: b.start_time,
          payment_method: b.payment_method || null,
          payment_status: b.payment_status,
          status: b.status,
        });
      }
    }

    // Desglose por empleado
    if (b.assigned_employee_id) {
      const empId = b.assigned_employee_id;
      if (!employeesMap[empId]) {
        employeesMap[empId] = {
          employee_id: empId,
          employee_name: employeeName,
          position: b.employees?.position || "Especialista",
          bookings_count: 0,
          completed_count: 0,
          total_revenue_collected_cents: 0,
        };
      }
      employeesMap[empId].bookings_count += 1;
      if (b.status === "completada") {
        employeesMap[empId].completed_count += 1;
      }
      // Ingreso cobrado asignado
      employeesMap[empId].total_revenue_collected_cents += b.advance_amount_cents || 0;
    }

    bookingsList.push({
      id: b.id,
      booking_code: b.booking_code,
      client_name: clientName,
      client_phone: b.client_phone,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
      employee_id: b.assigned_employee_id,
      employee_name: employeeName,
      service_names: serviceNamesArr.join(", ") || "General",
      service_type: b.service_type,
      total_price_cents: b.total_price_cents,
      advance_percentage: b.advance_percentage || 25,
      advance_required_cents: Math.ceil(b.total_price_cents * (b.advance_percentage || 25) / 100),
      advance_amount_cents: b.advance_amount_cents || 0,
      balance_cents: b.balance_cents || 0,
      booking_status: b.status,
      payment_status: b.payment_status,
      confirmed_at: b.confirmed_at,
      last_payment_method: b.payment_method || null,
      yape_paid_cents: 0,
      cash_paid_cents: 0,
      verified_by_name: null,
      created_at: b.created_at,
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Estructurar Resumen Financiero
  // ---------------------------------------------------------------------------
  const summary: FinancialSummary = {
    total_bookings: totalBookings,
    pending_bookings: pendingBookings,
    confirmed_bookings: confirmedBookings,
    completed_bookings: completedBookings,
    cancelled_bookings: cancelledBookings,
    spa_collected_cents: spaCollectedCents,
    barberia_collected_cents: barberiaCollectedCents,
    spa_bookings_count: spaBookingsCount,
    barberia_bookings_count: barberiaBookingsCount,
    total_services_value_cents: totalServicesValueCents,
    total_collected_cents: totalCollectedCents,
    yape_collected_cents: yapeCollectedCents,
    cash_collected_cents: cashCollectedCents,
    transfer_collected_cents: transferCollectedCents,
    mixed_collected_cents: mixedCollectedCents,
    culqi_collected_cents: culqiCollectedCents,
    advances_collected_cents: advancesCollectedCents,
    pending_balance_cents: pendingBalanceCents,
    total_expenses_cents: totalExpensesCents,
    net_result_cents: totalCollectedCents - totalExpensesCents,
  };

  return {
    filters,
    generated_at: new Date().toLocaleString("es-PE", { timeZone: "America/Lima" }),
    generated_by_name: generatedByName,
    summary,
    bookings: bookingsList,
    payments: paymentsList,
    services_breakdown: Object.values(servicesMap).sort((a, b) => b.times_booked - a.times_booked || b.total_revenue_cents - a.total_revenue_cents),
    employees_breakdown: Object.values(employeesMap).sort((a, b) => b.total_revenue_collected_cents - a.total_revenue_collected_cents),
    expenses: expensesList,
    completed_services_audit: completedServicesAuditList,
  };
}
