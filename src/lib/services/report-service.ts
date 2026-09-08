import { SupabaseClient } from "@supabase/supabase-js";
import { calculateParallelServiceSchedule } from "@/lib/utils/booking-schedule";
import type {
  ReportFilterParams,
  FullReportData,
  FinancialSummary,
  BookingReportItem,
  PaymentReportItem,
  ServicePerformanceItem,
  EmployeePerformanceItem,
  CompletedServiceAuditItem,
  CounterSaleReportItem,
} from "@/lib/types/reports";
import type { Expense } from "@/lib/types/expenses";

/**
 * REGLA ESTRICTA DE INGRESOS COBRADOS:
 * Coincidencia exacta con el módulo Inicio y Reservas:
 * Solo se suman ingresos de reservas en estado 'confirmada' o 'completada'.
 * El monto de ingreso cobrado corresponde estrictamente al dinero efectivamente recaudado y verificado (advance_amount_cents).
 * Si payment_status es 'total' y advance_amount_cents no estuviera seteado o fuera 0, se usa total_price_cents como respaldo.
 * Si una reserva está confirmada con 'sin_pago' (advance_amount_cents = 0), genera S/ 0.00 de ingreso cobrado.
 * Reservas en estado 'pendiente', 'cancelada' o 'expirada' retornan 0.
 */
export function calculateValidIncomeForBooking(b: {
  status?: string;
  advance_amount_cents?: number | null;
  payment_status?: string | null;
  total_price_cents?: number | null;
}): number {
  if (b.status !== "confirmada" && b.status !== "completada") {
    return 0;
  }

  const totalCents = b.total_price_cents || 0;

  // Si está marcado como pago total, el ingreso cobrado es exactamente el total pactado de la cita
  if (b.payment_status === "total") {
    return totalCents;
  }

  // Si es un pago parcial (adelanto verificado), acotado estrictamente al valor total de la cita
  if (b.advance_amount_cents !== undefined && b.advance_amount_cents !== null && b.advance_amount_cents > 0) {
    return Math.min(totalCents, b.advance_amount_cents);
  }

  return 0;
}

export function normalizePaymentMethod(method: string | null | undefined): string {
  if (!method) return "efectivo";
  const m = method.toLowerCase().trim();
  if (m === "cash" || m === "efectivo") return "efectivo";
  if (m === "yape") return "yape";
  if (m === "transfer" || m === "transferencia") return "transferencia";
  if (m === "mixed" || m === "mixto") return "mixto";
  if (m === "culqi_legacy") return "culqi_legacy";
  return m;
}

export function matchesPaymentMethodFilter(
  method: string | null | undefined,
  filter: string | null | undefined
): boolean {
  if (!filter || filter === "all") return true;
  const normFilter = normalizePaymentMethod(filter);
  const normMethod = normalizePaymentMethod(method);
  return normMethod === normFilter;
}

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function getEmployeeFullName(emp?: { first_name?: string | null; last_name?: string | null } | null): string {
  if (!emp) return "Sin asignar";
  const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
  return name || "Sin asignar";
}

function getEmployeePosition(type?: string | null): string {
  if (!type) return "Especialista";
  if (type === "barberia") return "Barbero";
  if (type === "spa") return "Especialista Spa";
  return type;
}

export function getPeruDateString(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
  } catch {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

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
  // 0. Consultar Empleados para mapeo y resolución de nombres independiente
  // ---------------------------------------------------------------------------
  const { data: allEmployeesData } = await supabase
    .from("employees")
    .select("id, first_name, last_name, type");

  const employeeMap = new Map<string, { id: string; first_name: string; last_name: string; type: string }>();
  if (allEmployeesData) {
    allEmployeesData.forEach((emp: any) => {
      employeeMap.set(emp.id, emp);
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Consultar Reservas dentro del Rango (Tabla bookings en Supabase)
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
      employees:assigned_employee_id (id, first_name, last_name, type),
      booking_services (
        id,
        service_id,
        service_name,
        service_price_cents,
        duration_minutes,
        assigned_employee_id,
        created_at,
        services:service_id (name, type)
      ),
      payment_logs (
        id,
        status
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
  // Nota: Si employeeId está definido, no se filtra a nivel SQL en bookings.assigned_employee_id
  // para permitir que reservas múltiples con especialistas asignados en booking_services sean recuperadas.

  const { data: rawBookings, error: bookingsErr } = await bookingsQuery;
  if (bookingsErr) {
    console.error("Error fetching bookings for report:", bookingsErr);
    throw new Error(`Error en consulta de reservas: ${bookingsErr.message || JSON.stringify(bookingsErr)}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Consultar Egresos en el Rango (Regla Estricta: Lógica de Egresos Intacta)
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
      employees:employee_id (first_name, last_name, type)
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
  // 1.1. Consultar Ventas de Mostrador (Productos Físicos)
  // ---------------------------------------------------------------------------
  let ventasQuery = supabase
    .from("ventas_mostrador")
    .select(`
      id,
      cliente_nombre,
      producto_nombre,
      cantidad,
      precio_unitario,
      total,
      metodo_pago,
      fecha,
      registrado_por,
      notas,
      created_at
    `)
    .order("fecha", { ascending: false });

  if (startDate) {
    ventasQuery = ventasQuery.gte("fecha", `${startDate}T00:00:00.000-05:00`);
  }
  if (endDate) {
    ventasQuery = ventasQuery.lte("fecha", `${endDate}T23:59:59.999-05:00`);
  }

  const { data: rawVentas, error: ventasErr } = await ventasQuery;
  if (ventasErr) {
    console.error("Error fetching ventas_mostrador for report:", ventasErr);
  }

  // ---------------------------------------------------------------------------
  // Tipos internos para rows
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
      id?: string;
      booking_code: string;
      client_first_name: string | null;
      client_last_name: string | null;
      client_phone?: string | null;
      booking_date?: string | null;
      service_type?: string | null;
      total_price_cents?: number | null;
      advance_amount_cents?: number | null;
      balance_cents?: number | null;
      payment_status?: string | null;
      assigned_employee_id?: string | null;
      booking_services?: Array<{
        id?: string;
        service_id?: string;
        service_name?: string | null;
        service_price_cents?: number | null;
        assigned_employee_id?: string | null;
        services?: { name?: string; type?: string } | null;
      }> | null;
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
      type: string | null;
    } | null;
  }

  interface RawBookingService {
    id?: string;
    service_id: string;
    service_name: string | null;
    service_price_cents: number;
    duration_minutes: number;
    assigned_employee_id?: string | null;
    created_at?: string;
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
      type: string;
    } | null;
    booking_services: RawBookingService[] | null;
    payment_logs?: { id: string; status: string }[] | null;
  }

  // Filtrar reservas por empleado, método de pago y término de búsqueda
  const filteredBookings = ((rawBookings || []) as unknown as RawBookingRow[]).filter((b) => {
    if (employeeId && employeeId !== "all") {
      const bServices = b.booking_services || [];
      const matchesParent = b.assigned_employee_id === employeeId;
      const matchesChild = bServices.some((bs) => bs.assigned_employee_id === employeeId);
      if (bServices.length >= 2) {
        if (!matchesChild) return false;
      } else {
        if (!matchesParent && !matchesChild) return false;
      }
    }
    if (paymentMethod && paymentMethod !== "all") {
      if (!matchesPaymentMethodFilter(b.payment_method, paymentMethod)) {
        return false;
      }
    }
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim().toLowerCase();
      const matchesCode = b.booking_code?.toLowerCase().includes(term);
      const matchesClient = clientName.includes(term);
      const matchesPhone = b.client_phone?.includes(term);
      if (!matchesCode && !matchesClient && !matchesPhone) {
        return false;
      }
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // 3. Consultar Pagos Verificados en el Rango de Fechas (Flujo de Caja Real)
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
      bookings (
        id,
        booking_code,
        client_first_name,
        client_last_name,
        client_phone,
        booking_date,
        service_type,
        total_price_cents,
        advance_amount_cents,
        balance_cents,
        payment_status,
        assigned_employee_id,
        booking_services (
          id,
          service_id,
          service_name,
          service_price_cents,
          assigned_employee_id,
          services:service_id (name, type)
        )
      )
    `)
    .order("paid_at", { ascending: false });

  if (startDate) {
    paymentsQuery = paymentsQuery.gte("paid_at", `${startDate}T00:00:00.000-05:00`);
  }
  if (endDate) {
    paymentsQuery = paymentsQuery.lte("paid_at", `${endDate}T23:59:59.999-05:00`);
  }

  const { data: pData, error: paymentsErr } = await paymentsQuery;
  let rawPayments: RawPaymentRow[] = [];
  if (paymentsErr) {
    console.error("Error fetching payment logs for report:", paymentsErr);
  } else if (pData) {
    rawPayments = pData as unknown as RawPaymentRow[];
  }

  // Filtrar pagos por método de pago, empleado, término de búsqueda y estado de pago
  const filteredPayments = rawPayments.filter((p) => {
    if (paymentMethod && paymentMethod !== "all") {
      if (!matchesPaymentMethodFilter(p.payment_method, paymentMethod)) {
        return false;
      }
    }

    const b = p.bookings;

    if (employeeId && employeeId !== "all") {
      if (!b) return false;
      const bServices = b.booking_services || [];
      const matchesParent = b.assigned_employee_id === employeeId;
      const matchesChild = bServices.some((bs) => bs.assigned_employee_id === employeeId);
      if (bServices.length >= 2) {
        if (!matchesChild) return false;
      } else {
        if (!matchesParent && !matchesChild) return false;
      }
    }

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const clientName = `${b?.client_first_name || ""} ${b?.client_last_name || ""}`.trim().toLowerCase();
      const matchesCode = b?.booking_code?.toLowerCase().includes(term);
      const matchesClient = clientName.includes(term);
      const matchesPhone = b?.client_phone?.includes(term);
      if (!matchesCode && !matchesClient && !matchesPhone) {
        return false;
      }
    }

    if (paymentStatus && paymentStatus !== "all") {
      if (paymentStatus === "parcial") {
        if (p.payment_type !== "advance") return false;
      } else if (paymentStatus === "total") {
        if (p.payment_type !== "balance" && p.payment_type !== "full") return false;
      } else if (paymentStatus === "sin_pago") {
        return false;
      }
    }

    return true;
  });

  // ---------------------------------------------------------------------------
  // 4. Mapear y procesar Egresos (Intacto)
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
  // 5. Mapear Reservas y Calcular Desgloses Unificados
  // ---------------------------------------------------------------------------
  const bookingsList: BookingReportItem[] = [];
  const completedServicesAuditList: CompletedServiceAuditItem[] = [];
  const servicesMap: Record<string, ServicePerformanceItem> = {};
  const employeesMap: Record<string, EmployeePerformanceItem> = {};

  let totalServicesValueCents = 0;
  let totalCollectedCents = 0;
  let yapeCollectedCents = 0;
  let cashCollectedCents = 0;
  let transferCollectedCents = 0;
  let mixedCollectedCents = 0;
  let culqiCollectedCents = 0;
  let advancesCollectedCents = 0;
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

  // ---------------------------------------------------------------------------
  // 4.1. Procesar Ventas de Mostrador (Capa Aditiva y Desacoplada)
  // ---------------------------------------------------------------------------
  const counterSalesList: CounterSaleReportItem[] = [];
  let counterSalesCollectedCents = 0;

  ((rawVentas || []) as unknown as Array<{
    id: string;
    cliente_nombre: string;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
    metodo_pago: string;
    fecha: string;
    registrado_por?: string | null;
    notas?: string | null;
  }>).forEach((v) => {
    // Verificación estricta de fecha en zona horaria local de Perú (America/Lima, UTC-5)
    if (v.fecha) {
      const vDate = new Date(v.fecha);
      if (!isNaN(vDate.getTime())) {
        const peruDateStr = getPeruDateString(vDate);
        if (startDate && peruDateStr < startDate) {
          return;
        }
        if (endDate && peruDateStr > endDate) {
          return;
        }
      }
    }

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchClient = v.cliente_nombre?.toLowerCase().includes(term);
      const matchProduct = v.producto_nombre?.toLowerCase().includes(term);
      if (!matchClient && !matchProduct) {
        return;
      }
    }

    if (paymentMethod && paymentMethod !== "all") {
      if (!matchesPaymentMethodFilter(v.metodo_pago, paymentMethod)) {
        return;
      }
    }

    const totalCents = Math.round(Number(v.total) * 100);
    counterSalesCollectedCents += totalCents;

    const normPay = normalizePaymentMethod(v.metodo_pago);
    if (normPay === "yape") {
      yapeCollectedCents += totalCents;
    } else if (normPay === "efectivo") {
      cashCollectedCents += totalCents;
    } else if (normPay === "transferencia") {
      transferCollectedCents += totalCents;
    } else if (normPay === "mixto") {
      mixedCollectedCents += totalCents;
    }

    counterSalesList.push({
      id: v.id,
      cliente_nombre: v.cliente_nombre,
      producto_nombre: v.producto_nombre,
      cantidad: v.cantidad,
      precio_unitario: Number(v.precio_unitario),
      total: Number(v.total),
      total_cents: totalCents,
      metodo_pago: v.metodo_pago,
      fecha: v.fecha,
      registrado_por: v.registrado_por,
      notas: v.notas,
    });
  });

  // Sumar ventas de mostrador a los ingresos consolidados
  totalCollectedCents += counterSalesCollectedCents;

    const empBookingsMap = new Map<string, Set<string>>();
  const empCompletedMap = new Map<string, Set<string>>();

  filteredBookings.forEach((b) => {
    const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim();
    totalBookings++;

    if (b.status === "pendiente") pendingBookings++;
    else if (b.status === "confirmada") confirmedBookings++;
    else if (b.status === "completada") completedBookings++;
    else if (b.status === "cancelada" || b.status === "expirada") cancelledBookings++;

    // Total valor contratado
    totalServicesValueCents += b.total_price_cents || 0;

    // Saldo pendiente en reservas activas
    if (b.status !== "cancelada" && b.status !== "expirada") {
      pendingBalanceCents += b.balance_cents || 0;
    }

    // Conteo de citas por categoría de servicio en la agenda
    if (b.service_type === "spa") {
      spaBookingsCount++;
    } else if (b.service_type === "barberia") {
      barberiaBookingsCount++;
    } else {
      const bServices = b.booking_services || [];
      const hasSpa = bServices.some((bs) => bs.services?.type === "spa");
      const hasBarberia = bServices.some((bs) => (bs.services?.type || "barberia") === "barberia");
      if (hasSpa) spaBookingsCount++;
      if (hasBarberia) barberiaBookingsCount++;
    }

    // -------------------------------------------------------------------------
    // Desglose de servicios, cronograma paralelo y asignación independiente
    // -------------------------------------------------------------------------
    const serviceNamesArr: string[] = [];
    const rawBServices = b.booking_services || [];
    const scheduleResult = calculateParallelServiceSchedule(
      b.start_time,
      rawBServices,
      b.assigned_employee_id
    );

    const isMultiService = rawBServices.length >= 2;

    const totalBookingServicesPrice = rawBServices.reduce(
      (sum, s) => sum + (s.service_price_cents || 0),
      0
    ) || b.total_price_cents || 1;

    const distinctAssignedWorkerNames: string[] = [];

    if (scheduleResult.scheduledServices.length > 0) {
      scheduleResult.scheduledServices.forEach((sched) => {
        const bs = sched.item;
        const sName = bs.service_name || bs.services?.name || "Servicio";
        const sType = bs.services?.type || b.service_type || "barberia";
        const sPrice = bs.service_price_cents !== undefined && bs.service_price_cents !== null
          ? bs.service_price_cents
          : (b.total_price_cents || 0);
        serviceNamesArr.push(sName);

        // Cronograma paralelo/secuencial calculado
        const duration = sched.durationMinutes;
        const startTimeStr = sched.startTimeStr;
        const endTimeStr = sched.endTimeStr;
        const workerId = sched.workerId;

        let workerName = "Sin asignar";
        let workerPos = "Especialista";

        if (workerId) {
          const empInfo = employeeMap.get(workerId);
          if (empInfo) {
            workerName = getEmployeeFullName(empInfo);
            workerPos = getEmployeePosition(empInfo.type);
          } else if (b.employees && b.employees.id === workerId) {
            workerName = getEmployeeFullName(b.employees);
            workerPos = getEmployeePosition(b.employees.type);
          }
        }

        if (workerName !== "Sin asignar" && !distinctAssignedWorkerNames.includes(workerName)) {
          distinctAssignedWorkerNames.push(workerName);
        }

        // Catálogo de servicios general
        const catKey = bs.service_id || sName;
        if (!servicesMap[catKey]) {
          servicesMap[catKey] = {
            service_id: bs.service_id || sName,
            service_name: sName,
            service_type: sType,
            price_cents: sPrice,
            duration_minutes: duration,
            times_booked: 0,
            total_revenue_cents: 0,
          };
        }
        servicesMap[catKey].times_booked += 1;
        if (b.status !== "cancelada" && b.status !== "expirada") {
          servicesMap[catKey].total_revenue_cents += sPrice;
        }

        // Auditoría con especialista y horario exacto desvinculado
        const matchesEmployeeFilter = !employeeId || employeeId === "all" || workerId === employeeId;

        if (matchesEmployeeFilter && b.status !== "cancelada" && b.status !== "expirada") {
          completedServicesAuditList.push({
            id: `${b.id}_${bs.id || bs.service_id || Math.random().toString(36).substring(2, 7)}`,
            booking_id: b.id,
            booking_code: b.booking_code,
            client_name: clientName,
            service_name: sName,
            service_type: sType,
            price_cents: sPrice,
            employee_name: workerName,
            date_exact: `${b.booking_date} ${startTimeStr.slice(0, 5)}`.trim(),
            booking_date: b.booking_date,
            start_time: startTimeStr,
            end_time: endTimeStr,
            duration_minutes: duration,
            payment_method: b.payment_method || null,
            payment_status: b.payment_status,
            status: b.status,
          });
        }

        // Desglose de desempeño por colaborador (employees_breakdown)
        if (workerId && matchesEmployeeFilter) {
          if (!employeesMap[workerId]) {
            employeesMap[workerId] = {
              employee_id: workerId,
              employee_name: workerName,
              position: workerPos,
              bookings_count: 0,
              completed_count: 0,
              total_revenue_collected_cents: 0,
              total_duration_minutes: 0,
            };
          }

          if (!empBookingsMap.has(workerId)) empBookingsMap.set(workerId, new Set());
          empBookingsMap.get(workerId)!.add(b.id);
          employeesMap[workerId].bookings_count = empBookingsMap.get(workerId)!.size;

          if (b.status === "completada") {
            if (!empCompletedMap.has(workerId)) empCompletedMap.set(workerId, new Set());
            empCompletedMap.get(workerId)!.add(b.id);
            employeesMap[workerId].completed_count = empCompletedMap.get(workerId)!.size;
          }

          if (b.status !== "cancelada" && b.status !== "expirada") {
            employeesMap[workerId].total_duration_minutes =
              (employeesMap[workerId].total_duration_minutes || 0) + duration;
          }
        }
      });
    } else {
      const sName = b.service_type === "spa" ? "Servicio Spa" : "Servicio Barbería";
      serviceNamesArr.push(sName);

      const workerId = b.assigned_employee_id || null;
      let workerName = "Sin asignar";
      let workerPos = "Especialista";

      if (workerId) {
        const empInfo = employeeMap.get(workerId);
        if (empInfo) {
          workerName = getEmployeeFullName(empInfo);
          workerPos = getEmployeePosition(empInfo.type);
        } else if (b.employees) {
          workerName = getEmployeeFullName(b.employees);
          workerPos = getEmployeePosition(b.employees.type);
        }
      }

      if (workerName !== "Sin asignar") {
        distinctAssignedWorkerNames.push(workerName);
      }

      const duration = Math.max(1, parseTimeToMinutes(b.end_time) - parseTimeToMinutes(b.start_time)) || 30;
      const matchesEmployeeFilter = !employeeId || employeeId === "all" || workerId === employeeId;

      if (matchesEmployeeFilter && b.status !== "cancelada" && b.status !== "expirada") {
        completedServicesAuditList.push({
          id: `${b.id}_main`,
          booking_id: b.id,
          booking_code: b.booking_code,
          client_name: clientName,
          service_name: sName,
          service_type: b.service_type || "barberia",
          price_cents: b.total_price_cents,
          employee_name: workerName,
          date_exact: `${b.booking_date} ${b.start_time ? b.start_time.slice(0, 5) : ""}`.trim(),
          booking_date: b.booking_date,
          start_time: b.start_time,
          end_time: b.end_time,
          duration_minutes: duration,
          payment_method: b.payment_method || null,
          payment_status: b.payment_status,
          status: b.status,
        });
      }

      if (workerId && matchesEmployeeFilter) {
        if (!employeesMap[workerId]) {
          employeesMap[workerId] = {
            employee_id: workerId,
            employee_name: workerName,
            position: workerPos,
            bookings_count: 0,
            completed_count: 0,
            total_revenue_collected_cents: 0,
            total_duration_minutes: 0,
          };
        }

        if (!empBookingsMap.has(workerId)) empBookingsMap.set(workerId, new Set());
        empBookingsMap.get(workerId)!.add(b.id);
        employeesMap[workerId].bookings_count = empBookingsMap.get(workerId)!.size;

        if (b.status === "completada") {
          if (!empCompletedMap.has(workerId)) empCompletedMap.set(workerId, new Set());
          empCompletedMap.get(workerId)!.add(b.id);
          employeesMap[workerId].completed_count = empCompletedMap.get(workerId)!.size;
        }

        if (b.status !== "cancelada" && b.status !== "expirada") {
          employeesMap[workerId].total_duration_minutes =
            (employeesMap[workerId].total_duration_minutes || 0) + duration;
        }
      }
    }

    // Nombre de empleado para la fila resumen de bookingsList
    let bookingEmployeeName = "Sin asignar";
    if (isMultiService) {
      bookingEmployeeName = distinctAssignedWorkerNames.length > 0
        ? distinctAssignedWorkerNames.join(", ")
        : "Sin asignar";
    } else {
      bookingEmployeeName = distinctAssignedWorkerNames[0] || (b.employees ? `${b.employees.first_name || ""} ${b.employees.last_name || ""}`.trim() : "Sin asignar");
    }

    // Resolver método de pago efectivo
    const bookingVerifiedPayment = rawPayments.find(
      (p) => p.booking_id === b.id && p.status === "verified" && p.payment_method
    );
    const effectivePaymentMethod = b.payment_method || bookingVerifiedPayment?.payment_method || null;

    bookingsList.push({
      id: b.id,
      booking_code: b.booking_code,
      client_name: clientName,
      client_phone: b.client_phone,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: rawBServices.length > 0 ? scheduleResult.endTimeStr : b.end_time,
      employee_id: b.assigned_employee_id,
      employee_name: bookingEmployeeName,
      service_names: serviceNamesArr.join(", ") || "General",
      service_type: b.service_type,
      total_price_cents: b.total_price_cents,
      advance_percentage: b.advance_percentage || 25,
      advance_required_cents: Math.ceil((b.total_price_cents * (b.advance_percentage || 25)) / 100),
      advance_amount_cents: b.advance_amount_cents || 0,
      balance_cents: b.balance_cents || 0,
      booking_status: b.status,
      payment_status: b.payment_status,
      confirmed_at: b.confirmed_at,
      last_payment_method: effectivePaymentMethod,
      yape_paid_cents: 0,
      cash_paid_cents: 0,
      verified_by_name: null,
      created_at: b.created_at,
    });
  });

  // ---------------------------------------------------------------------------
  // 5.1. Cómputo de Ingresos Reales Cobrados (Flujo de Caja Estricto por paid_at)
  // ---------------------------------------------------------------------------
  const coveredBookingIds = new Set<string>();

  // A. Sumar cada pago real verificado efectuado en este periodo de tiempo
  filteredPayments.forEach((p) => {
    coveredBookingIds.add(p.booking_id);

    // Solo pagos verificados y no anulados ingresan al flujo de caja
    if (p.status !== "verified" || p.voided_at) return;

    const amount = p.amount_cents || 0;
    totalCollectedCents += amount;

    if (p.payment_type === "advance") {
      advancesCollectedCents += amount;
    }

    // Desglose por método de pago real
    const normMethod = normalizePaymentMethod(p.payment_method);
    if (normMethod === "yape") {
      yapeCollectedCents += amount;
    } else if (normMethod === "efectivo") {
      cashCollectedCents += amount;
    } else if (normMethod === "transferencia") {
      transferCollectedCents += amount;
    } else if (normMethod === "mixto") {
      mixedCollectedCents += amount;
      const yPart = p.yape_amount_cents || 0;
      const cPart = p.cash_amount_cents || 0;
      if (yPart > 0 || cPart > 0) {
        yapeCollectedCents += yPart;
        cashCollectedCents += cPart;
      } else {
        const half = Math.floor(amount / 2);
        yapeCollectedCents += half;
        cashCollectedCents += (amount - half);
      }
    } else if (normMethod === "culqi_legacy") {
      culqiCollectedCents += amount;
    } else {
      cashCollectedCents += amount;
    }

    // Segmentación Spa vs Barbería
    const b = p.bookings;
    if (b) {
      if (b.service_type === "spa") {
        spaCollectedCents += amount;
      } else if (b.service_type === "barberia") {
        barberiaCollectedCents += amount;
      } else {
        const bServices = b.booking_services || [];
        let spaSum = 0;
        let barberiaSum = 0;
        bServices.forEach((bs: any) => {
          const type = bs.services?.type || "barberia";
          const price = bs.service_price_cents || 0;
          if (type === "spa") spaSum += price;
          else barberiaSum += price;
        });
        const sumTotal = spaSum + barberiaSum || 1;
        const spaRatio = spaSum / sumTotal;
        const spaAmount = Math.round(amount * spaRatio);
        const barberiaAmount = amount - spaAmount;
        spaCollectedCents += spaAmount;
        barberiaCollectedCents += barberiaAmount;
      }

      // Distribución de ingresos cobrados al colaborador asignado
      const bServices = b.booking_services || [];
      const totalBServicesPrice = bServices.reduce(
        (sum: number, s: any) => sum + (s.service_price_cents || 0),
        0
      ) || b.total_price_cents || 1;

      if (bServices.length > 0) {
        bServices.forEach((bs: any) => {
          const workerId = bs.assigned_employee_id || b.assigned_employee_id;
          if (workerId) {
            const sPrice = bs.service_price_cents || 0;
            const share = totalBServicesPrice > 0 ? sPrice / totalBServicesPrice : 1 / bServices.length;
            const allocated = Math.round(amount * share);
            if (!employeesMap[workerId]) {
              const empInfo = employeeMap.get(workerId);
              employeesMap[workerId] = {
                employee_id: workerId,
                employee_name: empInfo ? getEmployeeFullName(empInfo) : "Sin asignar",
                position: empInfo ? getEmployeePosition(empInfo.type) : "Especialista",
                bookings_count: 0,
                completed_count: 0,
                total_revenue_collected_cents: 0,
                total_duration_minutes: 0,
              };
            }
            employeesMap[workerId].total_revenue_collected_cents += allocated;
          }
        });
      } else if (b.assigned_employee_id) {
        const workerId = b.assigned_employee_id;
        if (!employeesMap[workerId]) {
          const empInfo = employeeMap.get(workerId);
          employeesMap[workerId] = {
            employee_id: workerId,
            employee_name: empInfo ? getEmployeeFullName(empInfo) : "Sin asignar",
            position: empInfo ? getEmployeePosition(empInfo.type) : "Especialista",
            bookings_count: 0,
            completed_count: 0,
            total_revenue_collected_cents: 0,
            total_duration_minutes: 0,
          };
        }
        employeesMap[workerId].total_revenue_collected_cents += amount;
      }
    }
  });

  // B. Compatibilidad histórica para reservas confirmadas sin registro en payment_logs
  filteredBookings.forEach((b) => {
    const hasLogs = (b as any).payment_logs && (b as any).payment_logs.length > 0;
    if (!hasLogs && !coveredBookingIds.has(b.id)) {
      const validIncomeCents = calculateValidIncomeForBooking(b);
      const isConfirmedOrCompleted = b.status === "confirmada" || b.status === "completada";

      if (isConfirmedOrCompleted && validIncomeCents > 0) {
        totalCollectedCents += validIncomeCents;

        const normMethod = normalizePaymentMethod(b.payment_method);
        if (normMethod === "yape") yapeCollectedCents += validIncomeCents;
        else if (normMethod === "efectivo") cashCollectedCents += validIncomeCents;
        else if (normMethod === "transferencia") transferCollectedCents += validIncomeCents;
        else if (normMethod === "mixto") {
          mixedCollectedCents += validIncomeCents;
          const half = Math.floor(validIncomeCents / 2);
          yapeCollectedCents += half;
          cashCollectedCents += (validIncomeCents - half);
        } else if (normMethod === "culqi_legacy") culqiCollectedCents += validIncomeCents;
        else cashCollectedCents += validIncomeCents;

        if (b.payment_status === "parcial") {
          advancesCollectedCents += validIncomeCents;
        }

        if (b.service_type === "spa") {
          spaCollectedCents += validIncomeCents;
        } else if (b.service_type === "barberia") {
          barberiaCollectedCents += validIncomeCents;
        } else {
          const bServices = b.booking_services || [];
          let spaSum = 0;
          let barberiaSum = 0;
          bServices.forEach((bs) => {
            const type = bs.services?.type || "barberia";
            const price = bs.service_price_cents || 0;
            if (type === "spa") spaSum += price;
            else barberiaSum += price;
          });
          const sumTotal = spaSum + barberiaSum || 1;
          const spaRatio = spaSum / sumTotal;
          const spaAmount = Math.round(validIncomeCents * spaRatio);
          const barberiaAmount = validIncomeCents - spaAmount;
          spaCollectedCents += spaAmount;
          barberiaCollectedCents += barberiaAmount;
        }

        if (b.assigned_employee_id) {
          if (!employeesMap[b.assigned_employee_id]) {
            const empInfo = employeeMap.get(b.assigned_employee_id);
            employeesMap[b.assigned_employee_id] = {
              employee_id: b.assigned_employee_id,
              employee_name: empInfo ? getEmployeeFullName(empInfo) : "Sin asignar",
              position: empInfo ? getEmployeePosition(empInfo.type) : "Especialista",
              bookings_count: 0,
              completed_count: 0,
              total_revenue_collected_cents: 0,
              total_duration_minutes: 0,
            };
          }
          employeesMap[b.assigned_employee_id].total_revenue_collected_cents += validIncomeCents;
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Construir Lista de Pagos (payment_logs reales + reservas históricas)
  // ---------------------------------------------------------------------------
  const paymentsList: PaymentReportItem[] = [];

  filteredPayments.forEach((p) => {
    const clientName = p.bookings
      ? `${p.bookings.client_first_name || ""} ${p.bookings.client_last_name || ""}`.trim()
      : "Cliente";

    paymentsList.push({
      id: p.id,
      booking_id: p.booking_id,
      booking_code: p.bookings?.booking_code || "—",
      client_name: clientName,
      amount_cents: p.amount_cents,
      payment_method: p.payment_method,
      payment_type: p.payment_type || "total",
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

  // Sintetizar entradas solo para reservas confirmadas históricas sin filas en payment_logs
  filteredBookings.forEach((b) => {
    const hasLogs = (b as any).payment_logs && (b as any).payment_logs.length > 0;
    const validIncome = calculateValidIncomeForBooking(b);
    if (!hasLogs && validIncome > 0 && !coveredBookingIds.has(b.id)) {
      const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim();
      paymentsList.push({
        id: `direct_${b.id}`,
        booking_id: b.id,
        booking_code: b.booking_code,
        client_name: clientName,
        amount_cents: validIncome,
        payment_method: b.payment_method || "efectivo",
        payment_type: b.payment_status === "total" ? "total" : "advance",
        yape_amount_cents: b.payment_method === "yape" ? validIncome : 0,
        cash_amount_cents: b.payment_method === "cash" || b.payment_method === "efectivo" ? validIncome : 0,
        status: "verified",
        notes: "Cobro registrado en reserva (histórico)",
        proof_url: null,
        paid_at: b.confirmed_at || b.created_at,
        registered_by_name: null,
        voided_at: null,
        voided_by_name: null,
        void_reason: null,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Estructurar Resumen Financiero Unificado
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
    counter_sales_collected_cents: counterSalesCollectedCents,
    counter_sales_count: counterSalesList.length,
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
    services_breakdown: Object.values(servicesMap).sort(
      (a, b) => b.times_booked - a.times_booked || b.total_revenue_cents - a.total_revenue_cents
    ),
    employees_breakdown: Object.values(employeesMap).sort(
      (a, b) => b.total_revenue_collected_cents - a.total_revenue_collected_cents || (b.total_duration_minutes || 0) - (a.total_duration_minutes || 0)
    ),
    expenses: expensesList,
    completed_services_audit: completedServicesAuditList,
    counter_sales: counterSalesList,
  };
}

