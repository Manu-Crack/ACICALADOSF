import ExcelJS from "exceljs";
import type { FullReportData } from "@/lib/types/reports";

/**
 * Neutraliza posibles inyecciones de fórmulas de Excel (=, +, -, @, \t, \r) en datos de texto de usuario.
 * Previene ejecución no deseada de fórmulas al abrir el archivo en MS Excel / LibreOffice.
 */
export function sanitizeForExcel(val: string): string;
export function sanitizeForExcel<T>(val: T): T;
export function sanitizeForExcel(val: unknown): unknown {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (
      trimmed.startsWith("=") ||
      trimmed.startsWith("+") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("@") ||
      trimmed.startsWith("\t") ||
      trimmed.startsWith("\r")
    ) {
      return `'${val}`;
    }
  }
  return val;
}

/**
 * Generador de Reportes en Excel (.xlsx) Multi-Hoja con ExcelJS.
 * Sistema: Acicalados Spa & Barber Shop
 */
export async function generateExcelReport(data: FullReportData): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Acicalados Spa & Barber Shop";
  workbook.created = new Date();

  const HEADER_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B160E" },
  };

  const HEADER_FONT: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFD4AF37" }, // Gold
  };

  const SECTION_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF7F2E7" }, // Light Gold Cream
  };

  const CURRENCY_FORMAT = '"S/" #,##0.00;[Red]-"S/" #,##0.00;"S/" 0.00';

  // =========================================================================
  // HOJA 1: RESUMEN FINANCIERO Y OPERATIVO
  // =========================================================================
  const wsResumen = workbook.addWorksheet("Resumen Ejecutivo", {
    views: [{ showGridLines: true }],
  });

  // Título
  wsResumen.mergeCells("A1:D1");
  const titleCell = wsResumen.getCell("A1");
  titleCell.value = "ACICALADOS SPA & BARBER SHOP — REPORTE FINANCIERO";
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFD4AF37" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsResumen.getRow(1).height = 28;

  // Metadatos
  wsResumen.addRow(["Fecha de emisión:", data.generated_at, "Generado por:", sanitizeForExcel(data.generated_by_name)]);
  wsResumen.addRow([
    "Rango consultado:",
    `${data.filters.startDate || "Inicio"} al ${data.filters.endDate || "Hoy"}`,
    "Filtro empleado:",
    data.filters.employeeId ? "Individual" : "General (Todos)",
  ]);
  wsResumen.addRow([]);

  // KPIs de Reservas
  wsResumen.addRow(["MÉTRICA DE RESERVAS", "CANTIDAD", "", ""]);
  const kpiHeaderRow = wsResumen.lastRow!;
  kpiHeaderRow.font = HEADER_FONT;
  kpiHeaderRow.fill = HEADER_FILL;

  wsResumen.addRow(["Total de Reservas Registradas", data.summary.total_bookings]);
  wsResumen.addRow(["Reservas Pendientes de Cobro", data.summary.pending_bookings]);
  wsResumen.addRow(["Reservas Confirmadas (Con Adelanto/Total)", data.summary.confirmed_bookings]);
  wsResumen.addRow(["Reservas Completadas", data.summary.completed_bookings]);
  wsResumen.addRow(["Reservas Canceladas / Expiradas", data.summary.cancelled_bookings]);
  wsResumen.addRow([]);

  // Balance Financiero Real
  wsResumen.addRow(["CONCEPTO FINANCIERO", "MONTO (SOLES)", "DETALLE / NOTAS", ""]);
  const finHeaderRow = wsResumen.lastRow!;
  finHeaderRow.font = HEADER_FONT;
  finHeaderRow.fill = HEADER_FILL;

  const addFinRow = (label: string, cents: number, note: string, isBold = false, isNet = false) => {
    const row = wsResumen.addRow([label, cents / 100, note]);
    const numCell = row.getCell(2);
    numCell.numFmt = CURRENCY_FORMAT;
    if (isBold) {
      row.font = { bold: true };
    }
    if (isNet) {
      row.font = { bold: true, size: 12, color: { argb: cents >= 0 ? "FF2E7D32" : "FFC62828" } };
      row.fill = SECTION_FILL;
    }
  };

  addFinRow("1. Valor de Servicios Reservados (Pactado)", data.summary.total_services_value_cents, "Valor total de servicios en las reservas del rango");
  addFinRow("2. INGRESOS REALMENTE COBRADOS", data.summary.total_collected_cents, "Dinero verificado y recibido en caja/cuentas", true);
  addFinRow("   • Cobrado por Yape", data.summary.yape_collected_cents, "Transferencias verificadas por Yape");
  addFinRow("   • Cobrado en Efectivo", data.summary.cash_collected_cents, "Efectivo recibido en caja");
  if (data.summary.culqi_collected_cents && data.summary.culqi_collected_cents > 0) {
    addFinRow("   • Cobrado por Culqi (Histórico)", data.summary.culqi_collected_cents, "Pagos con tarjeta procesados exitosamente por Culqi");
  }
  addFinRow("   • Adelantos Recibidos (25%)", data.summary.advances_collected_cents, "Monto de adelantos para confirmación");
  addFinRow("3. Saldos Pendientes por Cobrar", data.summary.pending_balance_cents, "Monto restante en reservas activas no liquidadas");
  addFinRow("4. EGRESOS OPERATIVOS TOTALES", data.summary.total_expenses_cents, "Gastos activos registrados en el periodo", true);
  addFinRow("5. RESULTADO NETO (Ingresos - Egresos)", data.summary.net_result_cents, "Beneficio neto real del periodo", true, true);

  wsResumen.columns = [{ width: 44 }, { width: 22 }, { width: 48 }, { width: 20 }];

  // =========================================================================
  // HOJA 2: DETALLE DE RESERVAS
  // =========================================================================
  const wsReservas = workbook.addWorksheet("Reservas", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  wsReservas.columns = [
    { header: "Código", key: "code", width: 14 },
    { header: "Cliente", key: "client", width: 24 },
    { header: "Teléfono", key: "phone", width: 15 },
    { header: "Fecha", key: "date", width: 13 },
    { header: "Horario", key: "time", width: 14 },
    { header: "Empleado", key: "employee", width: 20 },
    { header: "Servicio(s)", key: "services", width: 28 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Total Servicio (S/)", key: "total", width: 18 },
    { header: "Adelanto Req. (S/)", key: "adv_req", width: 18 },
    { header: "Adelanto Pag. (S/)", key: "adv_paid", width: 18 },
    { header: "Total Pagado (S/)", key: "paid", width: 18 },
    { header: "Saldo Pend. (S/)", key: "balance", width: 18 },
    { header: "Estado Pago", key: "payment_status", width: 16 },
    { header: "Estado Reserva", key: "status", width: 16 },
    { header: "Fecha Confirm.", key: "confirmed_at", width: 18 },
    { header: "Verificado Por", key: "verified_by", width: 20 },
  ];

  const headerRow2 = wsReservas.getRow(1);
  headerRow2.font = HEADER_FONT;
  headerRow2.fill = HEADER_FILL;
  headerRow2.height = 24;

  data.bookings.forEach((b) => {
    const row = wsReservas.addRow({
      code: sanitizeForExcel(b.booking_code),
      client: sanitizeForExcel(b.client_name),
      phone: sanitizeForExcel(b.client_phone || "—"),
      date: b.booking_date,
      time: `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`,
      employee: sanitizeForExcel(b.employee_name || "Sin asignar"),
      services: sanitizeForExcel(b.service_names),
      type: b.service_type,
      total: b.total_price_cents / 100,
      adv_req: b.advance_required_cents / 100,
      adv_paid: b.advance_amount_cents / 100,
      paid: (b.yape_paid_cents + b.cash_paid_cents) / 100 || b.advance_amount_cents / 100,
      balance: b.balance_cents / 100,
      payment_status: b.payment_status,
      status: b.booking_status,
      confirmed_at: b.confirmed_at ? new Date(b.confirmed_at).toLocaleString("es-PE", { timeZone: "America/Lima" }) : "—",
      verified_by: sanitizeForExcel(b.verified_by_name || "—"),
    });

    [9, 10, 11, 12, 13].forEach((colIdx) => {
      row.getCell(colIdx).numFmt = CURRENCY_FORMAT;
    });
  });

  wsReservas.autoFilter = "A1:Q1";

  // =========================================================================
  // HOJA 3: MOVIMIENTOS DE PAGO
  // =========================================================================
  const wsPagos = workbook.addWorksheet("Pagos y Cobros", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  wsPagos.columns = [
    { header: "Cód. Reserva", key: "booking_code", width: 14 },
    { header: "Cliente", key: "client", width: 24 },
    { header: "Monto Total (S/)", key: "amount", width: 16 },
    { header: "Método", key: "method", width: 14 },
    { header: "Monto Yape (S/)", key: "yape", width: 16 },
    { header: "Monto Efect. (S/)", key: "cash", width: 16 },
    { header: "Tipo Movimiento", key: "type", width: 16 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Fecha y Hora", key: "date", width: 20 },
    { header: "Registrado Por", key: "registered_by", width: 20 },
    { header: "Notas / Ref.", key: "notes", width: 24 },
    { header: "Motivo Anulación", key: "void_reason", width: 24 },
  ];

  const headerRow3 = wsPagos.getRow(1);
  headerRow3.font = HEADER_FONT;
  headerRow3.fill = HEADER_FILL;
  headerRow3.height = 24;

  data.payments.forEach((p) => {
    const row = wsPagos.addRow({
      booking_code: sanitizeForExcel(p.booking_code),
      client: sanitizeForExcel(p.client_name),
      amount: p.amount_cents / 100,
      method: p.payment_method,
      yape: p.yape_amount_cents / 100,
      cash: p.cash_amount_cents / 100,
      type: p.payment_type,
      status: p.status,
      date: p.paid_at ? new Date(p.paid_at).toLocaleString("es-PE", { timeZone: "America/Lima" }) : "—",
      registered_by: sanitizeForExcel(p.registered_by_name || "—"),
      notes: sanitizeForExcel(p.notes || "—"),
      void_reason: sanitizeForExcel(p.void_reason || "—"),
    });

    [3, 5, 6].forEach((colIdx) => {
      row.getCell(colIdx).numFmt = CURRENCY_FORMAT;
    });

    if (p.status === "voided") {
      row.font = { color: { argb: "FF9E9E9E" }, strike: true };
    }
  });

  wsPagos.autoFilter = "A1:L1";

  // =========================================================================
  // HOJA 4: SERVICIOS
  // =========================================================================
  const wsServicios = workbook.addWorksheet("Rendimiento Servicios", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  wsServicios.columns = [
    { header: "Servicio", key: "name", width: 30 },
    { header: "Categoría", key: "type", width: 16 },
    { header: "Precio Lista (S/)", key: "price", width: 16 },
    { header: "Duración (min)", key: "duration", width: 16 },
    { header: "Veces Reservado", key: "count", width: 16 },
    { header: "Monto Total Generado (S/)", key: "revenue", width: 26 },
  ];

  const headerRow4 = wsServicios.getRow(1);
  headerRow4.font = HEADER_FONT;
  headerRow4.fill = HEADER_FILL;
  headerRow4.height = 24;

  data.services_breakdown.forEach((s) => {
    const row = wsServicios.addRow({
      name: sanitizeForExcel(s.service_name),
      type: s.service_type,
      price: s.price_cents / 100,
      duration: s.duration_minutes,
      count: s.times_booked,
      revenue: s.total_revenue_cents / 100,
    });

    row.getCell(3).numFmt = CURRENCY_FORMAT;
    row.getCell(6).numFmt = CURRENCY_FORMAT;
  });

  wsServicios.autoFilter = "A1:F1";

  // =========================================================================
  // HOJA 5: EMPLEADOS
  // =========================================================================
  const wsEmpleados = workbook.addWorksheet("Rendimiento Empleados", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  wsEmpleados.columns = [
    { header: "Empleado", key: "name", width: 28 },
    { header: "Cargo", key: "position", width: 20 },
    { header: "Total Reservas Asignadas", key: "bookings", width: 24 },
    { header: "Reservas Completadas", key: "completed", width: 22 },
    { header: "Ingresos Cobrados Asociados (S/)", key: "revenue", width: 30 },
  ];

  const headerRow5 = wsEmpleados.getRow(1);
  headerRow5.font = HEADER_FONT;
  headerRow5.fill = HEADER_FILL;
  headerRow5.height = 24;

  data.employees_breakdown.forEach((e) => {
    const row = wsEmpleados.addRow({
      name: sanitizeForExcel(e.employee_name),
      position: sanitizeForExcel(e.position),
      bookings: e.bookings_count,
      completed: e.completed_count,
      revenue: e.total_revenue_collected_cents / 100,
    });

    row.getCell(5).numFmt = CURRENCY_FORMAT;
  });

  wsEmpleados.autoFilter = "A1:E1";

  // =========================================================================
  // HOJA 6: EGRESOS
  // =========================================================================
  const wsEgresos = workbook.addWorksheet("Egresos", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  wsEgresos.columns = [
    { header: "Fecha", key: "date", width: 14 },
    { header: "Categoría", key: "category", width: 18 },
    { header: "Descripción", key: "desc", width: 32 },
    { header: "Monto (S/)", key: "amount", width: 16 },
    { header: "Método Pago", key: "method", width: 16 },
    { header: "Proveedor", key: "supplier", width: 20 },
    { header: "Empleado Relacionado", key: "employee", width: 22 },
    { header: "Registrado Por", key: "registered_by", width: 20 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Motivo Anulación", key: "void_reason", width: 24 },
  ];

  const headerRow6 = wsEgresos.getRow(1);
  headerRow6.font = HEADER_FONT;
  headerRow6.fill = HEADER_FILL;
  headerRow6.height = 24;

  data.expenses.forEach((ex) => {
    const row = wsEgresos.addRow({
      date: ex.expense_date,
      category: ex.category,
      desc: sanitizeForExcel(ex.description),
      amount: ex.amount_cents / 100,
      method: ex.payment_method,
      supplier: sanitizeForExcel(ex.supplier || "—"),
      employee: sanitizeForExcel(ex.employee_name || "—"),
      registered_by: sanitizeForExcel(ex.registered_by_name || "—"),
      status: ex.status === "active" ? "Activo" : "Anulado",
      void_reason: sanitizeForExcel(ex.void_reason || "—"),
    });

    row.getCell(4).numFmt = CURRENCY_FORMAT;

    if (ex.status === "voided") {
      row.font = { color: { argb: "FF9E9E9E" }, strike: true };
    }
  });

  wsEgresos.autoFilter = "A1:J1";

  // Escribir buffer binario
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
