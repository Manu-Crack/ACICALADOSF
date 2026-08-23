import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface AgendaPdfBookingService {
  service_name: string;
  service_price_cents?: number;
  duration_minutes?: number;
}

export interface AgendaPdfBooking {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_price_cents: number;
  total_duration_minutes: number;
  assigned_employee_id: string | null;
  client_first_name: string;
  client_last_name: string;
  client_phone: string | null;
  client_email?: string | null;
  booking_services: AgendaPdfBookingService[];
}

export interface AgendaPdfEmployee {
  id: string;
  first_name: string;
  last_name: string;
  type: "barberia" | "spa" | "recepcionista" | string;
  is_active?: boolean;
}

export interface AgendaPdfOptions {
  bookings: AgendaPdfBooking[];
  employees: AgendaPdfEmployee[];
  selectedEmployeeId?: string; // "all", "unassigned", or employee ID
  dateFilter?: string; // "YYYY-MM-DD" or empty
  statusFilter?: string; // "all", "confirmada", etc.
  searchQuery?: string;
  generatedByName?: string;
}

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

const paymentLabels: Record<string, string> = {
  sin_pago: "Sin pago",
  pendiente: "Pendiente",
  parcial: "Parcial",
  total: "Pagado",
};

function formatDurationMinutes(mins: number): string {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

function formatDateSpanish(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-PE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function generateEmployeeAgendaPdf(options: AgendaPdfOptions): void {
  const {
    bookings,
    employees,
    selectedEmployeeId = "all",
    dateFilter,
    statusFilter,
    generatedByName = "Administrador",
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const GOLD_COLOR: [number, number, number] = [200, 164, 92]; // #C8A45C
  const DARK_BG: [number, number, number] = [27, 22, 14];      // #1B160E
  const TEXT_DARK: [number, number, number] = [30, 30, 30];
  const TEXT_MUTED: [number, number, number] = [100, 100, 100];
  const LIGHT_ROW_BG: [number, number, number] = [250, 248, 244];

  const fmtSoles = (cents: number) => `S/ ${((cents || 0) / 100).toFixed(2)}`;

  // Determine target employee if filtered
  const singleEmployee =
    selectedEmployeeId !== "all" && selectedEmployeeId !== "unassigned"
      ? employees.find((e) => e.id === selectedEmployeeId)
      : null;

  // =========================================================================
  // 1. CABECERA OFICIAL
  // =========================================================================
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, 210, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GOLD_COLOR);
  doc.text("ACICALADOS SPA & BARBER SHOP", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Agenda de Citas y Servicios Asignados por Trabajador", 14, 18);

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  doc.setFontSize(8);
  doc.text(`Fecha de Emisión: ${dateStr} ${timeStr}`, 196, 11, { align: "right" });
  doc.text(`Emitido por: ${generatedByName}`, 196, 17, { align: "right" });

  let yPos = 31;

  // =========================================================================
  // 2. METADATOS Y FILTROS ACTIVOS
  // =========================================================================
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(14, yPos - 3, 182, 16, 2, 2, "F");
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(14, yPos - 3, 182, 16, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);

  const workerLabel = singleEmployee
    ? `${singleEmployee.first_name} ${singleEmployee.last_name} (${singleEmployee.type === "barberia" ? "Barbería" : singleEmployee.type === "spa" ? "Spa" : "Recepción"})`
    : selectedEmployeeId === "unassigned"
    ? "Citas Sin Asignar"
    : "Todos los Trabajadores";

  doc.text("Trabajador:", 18, yPos + 3);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK_BG);
  doc.text(workerLabel, 40, yPos + 3);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("Filtro de Fecha:", 18, yPos + 9);
  doc.setFont("helvetica", "normal");
  doc.text(dateFilter ? formatDateSpanish(dateFilter) : "Todas las fechas", 44, yPos + 9);

  doc.setFont("helvetica", "bold");
  doc.text("Estado:", 130, yPos + 3);
  doc.setFont("helvetica", "normal");
  doc.text(
    statusFilter && statusFilter !== "all"
      ? statusLabels[statusFilter] || statusFilter
      : "Todos los estados",
    144,
    yPos + 3
  );

  doc.setFont("helvetica", "bold");
  doc.text("Total Citas:", 130, yPos + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD_COLOR);
  doc.text(String(bookings.length), 150, yPos + 9);

  yPos += 22;

  // If no bookings
  if (bookings.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      "No se encontraron citas asignadas para los filtros especificados.",
      14,
      yPos + 10
    );
    doc.save(
      `Agenda_${singleEmployee ? `${singleEmployee.first_name}_${singleEmployee.last_name}` : "Trabajadores"}_${dateFilter || dateStr}.pdf`
    );
    return;
  }

  // =========================================================================
  // 3. RESUMEN EJECUTIVO (KPIs)
  // =========================================================================
  const totalCitas = bookings.length;
  const confirmadas = bookings.filter((b) => b.status === "confirmada").length;
  const completadas = bookings.filter((b) => b.status === "completada").length;
  const totalIngresosCents = bookings
    .filter((b) => b.status === "completada" || b.payment_status === "total")
    .reduce((sum, b) => sum + (b.total_price_cents || 0), 0);

  autoTable(doc, {
    startY: yPos,
    head: [["TOTAL CITAS", "CONFIRMADAS", "COMPLETADAS", "INGRESOS GENERADOS"]],
    body: [
      [
        String(totalCitas),
        String(confirmadas),
        String(completadas),
        fmtSoles(totalIngresosCents),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: DARK_BG,
      textColor: GOLD_COLOR,
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      fontStyle: "bold",
      textColor: TEXT_DARK,
      halign: "center",
      fillColor: LIGHT_ROW_BG,
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastKpiTable = (doc as any).lastAutoTable;
  yPos = lastKpiTable ? lastKpiTable.finalY + 10 : yPos + 22;

  // =========================================================================
  // 4. TABLA DE CITAS AGRUPADAS POR DÍA / TRABAJADOR
  // =========================================================================

  // Group bookings by date (sorted descending or ascending)
  const bookingsByDate: Record<string, AgendaPdfBooking[]> = {};
  // Sort bookings by date then start_time
  const sortedBookings = [...bookings].sort((a, b) => {
    const cmpDate = (a.booking_date || "").localeCompare(b.booking_date || "");
    if (cmpDate !== 0) return cmpDate;
    return (a.start_time || "").localeCompare(b.start_time || "");
  });

  sortedBookings.forEach((b) => {
    const key = b.booking_date || "Sin Fecha";
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  });

  const employeeMap = new Map(
    employees.map((e) => [e.id, `${e.first_name} ${e.last_name}`])
  );

  // Iterate dates
  Object.entries(bookingsByDate).forEach(([dayDate, dayBookings]) => {
    // Check if new page needed
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Day Header Banner
    doc.setFillColor(235, 230, 220);
    doc.rect(14, yPos - 4, 182, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...DARK_BG);
    doc.text(
      `📅 ${formatDateSpanish(dayDate).toUpperCase()} (${dayBookings.length} ${dayBookings.length === 1 ? "cita" : "citas"})`,
      18,
      yPos + 1
    );

    yPos += 5;

    const tableRows = dayBookings.map((b) => {
      const hora = `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`;
      const cliente = `${b.client_first_name} ${b.client_last_name}\n${b.client_phone || ""}`.trim();
      const servicios = b.booking_services && b.booking_services.length > 0
        ? b.booking_services.map((s) => s.service_name).join("\n• ")
        : "Servicio estándar";
      const duracion = formatDurationMinutes(b.total_duration_minutes || 30);
      const trabajador = b.assigned_employee_id
        ? employeeMap.get(b.assigned_employee_id) || "Asignado"
        : "Sin asignar";
      const estado = statusLabels[b.status] || b.status;
      const pago = paymentLabels[b.payment_status] || b.payment_status;
      const total = fmtSoles(b.total_price_cents || 0);

      if (singleEmployee) {
        // Exclude worker column if single employee is filtered
        return [
          hora,
          b.booking_code,
          cliente,
          `• ${servicios}`,
          duracion,
          estado,
          pago,
          total,
        ];
      }

      return [
        hora,
        trabajador,
        b.booking_code,
        cliente,
        `• ${servicios}`,
        duracion,
        estado,
        pago,
        total,
      ];
    });

    const headers = singleEmployee
      ? [["Horario", "Código", "Cliente / Teléfono", "Servicio(s)", "Duración", "Estado", "Pago", "Total"]]
      : [["Horario", "Trabajador", "Código", "Cliente", "Servicio(s)", "Duración", "Estado", "Pago", "Total"]];

    autoTable(doc, {
      startY: yPos,
      head: headers,
      body: tableRows,
      theme: "striped",
      headStyles: {
        fillColor: DARK_BG,
        textColor: GOLD_COLOR,
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "left",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: TEXT_DARK,
        cellPadding: 2.5,
      },
      columnStyles: singleEmployee
        ? {
            0: { cellWidth: 20, fontStyle: "bold" },
            1: { cellWidth: 18, fontStyle: "bold" },
            2: { cellWidth: 35 },
            3: { cellWidth: 50 },
            4: { cellWidth: 16, halign: "center" },
            5: { cellWidth: 17, halign: "center" },
            6: { cellWidth: 14, halign: "center" },
            7: { cellWidth: 12, halign: "right", fontStyle: "bold" },
          }
        : {
            0: { cellWidth: 18, fontStyle: "bold" },
            1: { cellWidth: 26, fontStyle: "bold" },
            2: { cellWidth: 16 },
            3: { cellWidth: 30 },
            4: { cellWidth: 41 },
            5: { cellWidth: 15, halign: "center" },
            6: { cellWidth: 15, halign: "center" },
            7: { cellWidth: 11, halign: "center" },
            8: { cellWidth: 10, halign: "right", fontStyle: "bold" },
          },
      margin: { left: 14, right: 14 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastDayTable = (doc as any).lastAutoTable;
    yPos = lastDayTable ? lastDayTable.finalY + 8 : yPos + 30;
  });

  // =========================================================================
  // 5. PIE DE PÁGINA CON NÚMEROS DE PÁGINA
  // =========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Acicalados Spa & Barber Shop — Documento Oficial de Agenda de Personal`,
      14,
      290
    );
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: "right" });
  }

  // Trigger Save
  const fileName = singleEmployee
    ? `Agenda_${singleEmployee.first_name}_${singleEmployee.last_name}_${dateFilter || dateStr}.pdf`
    : `Agenda_Personal_Acicalados_${dateFilter || dateStr}.pdf`;

  doc.save(fileName);
}
