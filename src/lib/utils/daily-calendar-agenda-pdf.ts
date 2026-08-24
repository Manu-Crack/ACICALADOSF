import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CalendarEvent } from "@/lib/types/calendar";

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatSpanishDate(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthName = MONTH_NAMES[monthIndex] || "mes";
    return `${day} de ${monthName} de ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Genera y descarga el PDF de la agenda diaria a partir de los eventos del calendario.
 *
 * Columnas requeridas:
 * - Hora: Hora de la reserva (inicio - fin).
 * - Personal: Nombre del trabajador asignado.
 * - Tipo de Servicio: Barbería o Spa.
 * - Servicio: Nombre exacto del servicio a realizar.
 */
export function exportDailyCalendarAgendaPdf(dateStr: string, events: CalendarEvent[]): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const formattedDate = formatSpanishDate(dateStr);
  const now = new Date();
  const generatedAt = now.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Filtrar y ordenar eventos cronológicamente
  // Si hay eventos de tipo 'booking', los priorizamos; si no, mostramos todos los eventos de la agenda
  const bookingEvents = events
    .filter((e) => e.type === "booking" || e.details?.services)
    .sort((a, b) => (a.start_time || "00:00").localeCompare(b.start_time || "00:00"));

  const allSortedEvents = [...events].sort((a, b) =>
    (a.start_time || "00:00").localeCompare(b.start_time || "00:00")
  );

  const targetEvents = bookingEvents.length > 0 ? bookingEvents : allSortedEvents;

  // ---------------------------------------------------------------------------
  // ENCABEZADO DEL DOCUMENTO
  // ---------------------------------------------------------------------------
  const pageWidth = doc.internal.pageSize.getWidth();

  // Barra superior dorada
  doc.setFillColor(200, 164, 92); // Gold #C8A45C
  doc.rect(0, 0, pageWidth, 5, "F");

  // Bloque de cabecera oscura
  doc.setFillColor(18, 16, 12);
  doc.rect(0, 5, pageWidth, 28, "F");

  // Título principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(200, 164, 92);
  doc.text("ACICALADOS - SALÓN & SPA", 14, 16);

  // Subtítulo del reporte
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`AGENDA DIARIA DE CITAS — ${formattedDate.toUpperCase()}`, 14, 24);

  // Metadatos a la derecha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text(`Fecha de emisión: ${generatedAt}`, pageWidth - 14, 16, { align: "right" });
  doc.text(`Total de citas: ${targetEvents.length}`, pageWidth - 14, 22, { align: "right" });

  // ---------------------------------------------------------------------------
  // CONSTRUCCIÓN DE FILAS DE LA TABLA
  // ---------------------------------------------------------------------------
  const tableRows = targetEvents.map((ev) => {
    // 1. Hora
    const startTimeFormatted = ev.start_time ? ev.start_time.slice(0, 5) : "";
    const endTimeFormatted = ev.end_time ? ev.end_time.slice(0, 5) : "";
    const hora = startTimeFormatted
      ? endTimeFormatted
        ? `${startTimeFormatted} - ${endTimeFormatted}`
        : startTimeFormatted
      : "Todo el día";

    // 2. Personal
    const personal = ev.employee_name || "Sin asignar";

    // 3. Tipo de Servicio (Barbería o Spa)
    let tipoServicio = ev.employee_specialty || "Barbería";
    if (ev.description?.toLowerCase().includes("spa") || ev.title?.toLowerCase().includes("spa")) {
      tipoServicio = "Spa";
    }

    // 4. Servicio (Nombre exacto)
    let servicio = "Servicio general";
    if (ev.details?.services && Array.isArray(ev.details.services) && ev.details.services.length > 0) {
      servicio = ev.details.services.join(", ");
    } else if (ev.title) {
      servicio = ev.title.replace(/^Cita:\s*/i, "");
    }

    return [hora, personal, tipoServicio, servicio];
  });

  if (tableRows.length === 0) {
    tableRows.push(["—", "—", "—", "No hay citas programadas para este día."]);
  }

  // ---------------------------------------------------------------------------
  // TABLA AUTOTABLE
  // ---------------------------------------------------------------------------
  autoTable(doc, {
    startY: 38,
    head: [["HORA", "PERSONAL", "TIPO DE SERVICIO", "SERVICIO(S) A REALIZAR"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [26, 26, 26],
      textColor: [200, 164, 92],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 3.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [40, 40, 40],
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 247, 245],
    },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold", halign: "center" }, // Hora
      1: { cellWidth: 45, fontStyle: "bold" },                  // Personal
      2: { cellWidth: 35 },                                     // Tipo de Servicio
      3: { cellWidth: "auto" },                                 // Servicio
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Pie de página
      const pageNumber = data.pageNumber;
      const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Acicalados Salón & Spa · Agenda Diaria (${dateStr}) · Página ${pageNumber} de ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    },
  });

  // Guardar archivo PDF con nombre descriptivo
  const safeFilename = `Agenda_Diaria_${dateStr}.pdf`;
  doc.save(safeFilename);
}
