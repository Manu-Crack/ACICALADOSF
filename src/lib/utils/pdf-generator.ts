import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { FullReportData } from "@/lib/types/reports";

/**
 * Generador de Reportes en PDF con jsPDF y jsPDF-AutoTable.
 * Sistema: Acicalados Spa & Barber Shop
 */
export function generatePdfReport(data: FullReportData): Uint8Array {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const GOLD_COLOR: [number, number, number] = [200, 164, 92]; // #C8A45C
  const DARK_BG: [number, number, number] = [27, 22, 14];      // #1B160E
  const TEXT_DARK: [number, number, number] = [30, 30, 30];

  // Helper de formato de moneda
  const fmtSoles = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  // =========================================================================
  // CABECERA OFICIAL
  // =========================================================================
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, 297, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GOLD_COLOR);
  doc.text("ACICALADOS SPA & BARBER SHOP", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Reporte Financiero y Operativo Oficial", 14, 18);

  doc.setFontSize(8);
  doc.text(`Emitido: ${data.generated_at}`, 283, 11, { align: "right" });
  doc.text(`Generado por: ${data.generated_by_name}`, 283, 17, { align: "right" });

  // Barra de Metadatos y Filtros
  let yPos = 30;
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Parámetros del Reporte:", 14, yPos);

  doc.setFont("helvetica", "normal");
  const filterText = `Rango: ${data.filters.startDate || "Inicio"} al ${data.filters.endDate || "Hoy"}  |  Estado Reserva: ${data.filters.bookingStatus || "Todos"}  |  Estado Pago: ${data.filters.paymentStatus || "Todos"}  |  Empleado: ${data.filters.employeeId ? "Individual" : "Todos"}`;
  doc.text(filterText, 62, yPos);

  yPos += 8;

  // =========================================================================
  // SECCIÓN 1: BALANCE FINANCIERO Y RESULTADO NETO (TABLA RESUMEN)
  // =========================================================================
  const summaryBody = [
    [
      "Total Reservas:",
      String(data.summary.total_bookings),
      "Ingresos Cobrados (Real):",
      fmtSoles(data.summary.total_collected_cents),
      "Egresos Operativos:",
      fmtSoles(data.summary.total_expenses_cents),
    ],
    [
      "Confirmadas / Comp.:",
      `${data.summary.confirmed_bookings} / ${data.summary.completed_bookings}`,
      "• Por Yape:",
      fmtSoles(data.summary.yape_collected_cents),
      "Saldos Pendientes:",
      fmtSoles(data.summary.pending_balance_cents),
    ],
    [
      "Valor Contratado:",
      fmtSoles(data.summary.total_services_value_cents),
      "• En Efectivo:",
      fmtSoles(data.summary.cash_collected_cents),
      "RESULTADO NETO:",
      fmtSoles(data.summary.net_result_cents),
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["RESUMEN DE RESERVAS", "", "DESGLOSE DE INGRESOS COBRADOS", "", "BALANCE OPERATIVO", ""]],
    body: summaryBody,
    theme: "grid",
    headStyles: {
      fillColor: DARK_BG,
      textColor: GOLD_COLOR,
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: TEXT_DARK,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 38 },
      1: { cellWidth: 32 },
      2: { fontStyle: "bold", cellWidth: 48 },
      3: { cellWidth: 38, fontStyle: "bold" },
      4: { fontStyle: "bold", cellWidth: 42 },
      5: { cellWidth: 42, fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // SECCIÓN 2: DETALLE DE RESERVAS
  // =========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastAutoTable = (doc as any).lastAutoTable;
  yPos = lastAutoTable ? lastAutoTable.finalY + 8 : yPos + 35;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BG);
  doc.text("Detalle de Reservas del Periodo", 14, yPos);

  const bookingsRows = data.bookings.map((b) => {
    const isNoPayment = b.payment_status === "sin_pago" || (b.advance_amount_cents || 0) === 0;
    const methodKey = (b.last_payment_method || "").toLowerCase();
    const methodLabel = methodKey === "yape"
      ? "Yape"
      : methodKey === "cash" || methodKey === "efectivo"
      ? "Efectivo"
      : methodKey === "transfer" || methodKey === "transferencia"
      ? "Transferencia"
      : methodKey === "mixed" || methodKey === "mixto"
      ? "Mixto"
      : methodKey === "culqi_legacy"
      ? "Tarjeta (Culqi)"
      : b.last_payment_method || "";

    const combinedPay = isNoPayment
      ? "Sin pago"
      : b.payment_status === "parcial"
      ? methodLabel ? `Adelanto - ${methodLabel}` : "Adelanto"
      : methodLabel ? `Total - ${methodLabel}` : "Total";

    return [
      b.booking_code,
      b.client_name,
      b.client_phone || "—",
      b.booking_date,
      `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`,
      b.employee_name || "Sin asignar",
      b.service_names,
      fmtSoles(b.total_price_cents),
      fmtSoles(b.advance_amount_cents),
      fmtSoles(b.balance_cents),
      combinedPay,
      b.booking_status,
    ];
  });

  autoTable(doc, {
    startY: yPos + 3,
    head: [
      [
        "Código",
        "Cliente",
        "Teléfono",
        "Fecha",
        "Horario",
        "Empleado",
        "Servicio(s)",
        "Total (S/)",
        "Pagado",
        "Saldo",
        "Pago (Método)",
        "Estado",
      ],
    ],
    body: bookingsRows.length > 0 ? bookingsRows : [["No hay reservas en el periodo consultado.", "", "", "", "", "", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: {
      fillColor: DARK_BG,
      textColor: GOLD_COLOR,
      fontSize: 7.5,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: TEXT_DARK,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 16 },
      1: { cellWidth: 26 },
      2: { cellWidth: 18 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 22 },
      6: { cellWidth: 38 },
      7: { halign: "right", cellWidth: 16 },
      8: { halign: "right", cellWidth: 16 },
      9: { halign: "right", cellWidth: 16 },
      10: { cellWidth: 26 },
      11: { cellWidth: 16 },
    },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // SECCIÓN 3: RENDIMIENTO POR SERVICIOS Y POR EMPLEADOS
  // =========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastBookingsTable = (doc as any).lastAutoTable;
  yPos = lastBookingsTable ? lastBookingsTable.finalY + 8 : yPos + 40;

  // Si no queda suficiente espacio en la página, añadir nueva página
  if (yPos > 150) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BG);
  doc.text("Rendimiento por Servicios y Empleados", 14, yPos);

  const servicesRows = data.services_breakdown.map((s) => [
    s.service_name,
    s.service_type,
    fmtSoles(s.price_cents),
    String(s.times_booked),
    fmtSoles(s.total_revenue_cents),
  ]);

  autoTable(doc, {
    startY: yPos + 3,
    head: [["Servicio", "Tipo", "Precio Lista", "Veces Reservado", "Total Generado"]],
    body: servicesRows.length > 0 ? servicesRows : [["Sin registros de servicios.", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: DARK_BG, textColor: GOLD_COLOR, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 18 },
      2: { halign: "right", cellWidth: 22 },
      3: { halign: "center", cellWidth: 20 },
      4: { halign: "right", cellWidth: 26 },
    },
    margin: { left: 14, right: 152 },
  });

  const employeeRows = data.employees_breakdown.map((e) => [
    e.employee_name,
    e.position,
    String(e.bookings_count),
    String(e.completed_count),
    fmtSoles(e.total_revenue_collected_cents),
  ]);

  autoTable(doc, {
    startY: yPos + 3,
    head: [["Empleado", "Cargo", "Asignadas", "Completadas", "Cobrado Asociado"]],
    body: employeeRows.length > 0 ? employeeRows : [["Sin registros de empleados.", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: DARK_BG, textColor: GOLD_COLOR, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22 },
      2: { halign: "center", cellWidth: 20 },
      3: { halign: "center", cellWidth: 22 },
      4: { halign: "right", cellWidth: 26 },
    },
    margin: { left: 150, right: 14 },
  });

  // =========================================================================
  // SECCIÓN 4: EGRESOS OPERATIVOS
  // =========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastSection3 = (doc as any).lastAutoTable;
  yPos = lastSection3 ? lastSection3.finalY + 8 : yPos + 40;

  if (yPos > 150) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_BG);
  doc.text("Detalle de Egresos Operativos", 14, yPos);

  const expensesRows = data.expenses.map((ex) => [
    ex.expense_date,
    ex.category,
    ex.description,
    ex.payment_method,
    ex.supplier || "—",
    ex.employee_name || "—",
    ex.registered_by_name || "—",
    fmtSoles(ex.amount_cents),
    ex.status === "active" ? "Activo" : "Anulado",
  ]);

  autoTable(doc, {
    startY: yPos + 3,
    head: [["Fecha", "Categoría", "Descripción", "Método", "Proveedor", "Empleado", "Registrado Por", "Monto", "Estado"]],
    body: expensesRows.length > 0 ? expensesRows : [["No se registraron egresos en este periodo.", "", "", "", "", "", "", "", ""]],
    theme: "striped",
    headStyles: { fillColor: DARK_BG, textColor: GOLD_COLOR, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  // =========================================================================
  // PIE DE PÁGINA Y NUMERACIÓN
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Acicalados Spa & Barber Shop — Confidencial y de uso interno exclusivo", 14, 204);
    doc.text(`Página ${i} de ${totalPages}`, 283, 204, { align: "right" });
  }

  const output = doc.output("arraybuffer");
  return new Uint8Array(output);
}
