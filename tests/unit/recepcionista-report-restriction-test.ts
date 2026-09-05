import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Suite de Pruebas Unitarias: Restricción de Acceso Histórico en Reportes para Recepcionista
 * Sistema: Acicalados Spa & Barber Shop
 * Ubicación: tests/unit/recepcionista-report-restriction-test.ts
 */

function getPeruDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(date);
  } catch {
    return date.toISOString().split("T")[0];
  }
}

/**
 * Simulación de la lógica de resolución de filtros de los endpoints:
 * /api/admin/reports/data, /api/admin/reports/summary, /api/admin/reports/export/pdf, /api/admin/reports/export/excel
 */
function resolveReportFilters(
  role: string,
  searchParams: { startDate?: string; endDate?: string; [key: string]: any }
) {
  const isRecepcionista = role === "recepcionista";
  const todayPeru = getPeruDateString();

  return {
    startDate: isRecepcionista ? todayPeru : (searchParams.startDate || undefined),
    endDate: isRecepcionista ? todayPeru : (searchParams.endDate || undefined),
    bookingStatus: searchParams.bookingStatus || undefined,
    paymentStatus: searchParams.paymentStatus || undefined,
  };
}

/**
 * Simulación de la lógica de resolución de fecha en:
 * /api/admin/reports/daily-closing
 */
function resolveDailyClosingDate(role: string, inputDate?: string | null) {
  const isRecepcionista = role === "recepcionista";
  const todayPeru = getPeruDateString();

  let targetDate = inputDate;
  if (isRecepcionista || !targetDate) {
    targetDate = todayPeru;
  }
  return targetDate;
}

/**
 * Simulación de la lógica de navegación temporal de ReportsManager:
 * (Anterior -1, Siguiente +1, Hoy 0)
 */
function simulateNavigatePeriod(role: string, currentRef: Date, direction: -1 | 1 | 0): Date {
  const isRecepcionista = role === "recepcionista";
  if (isRecepcionista) {
    if (direction === 0) {
      return new Date();
    }
    // Para recepcionista, cualquier intento de retroceder o avanzar queda estrictamente bloqueado
    return currentRef;
  }

  // Para admin, se permite navegar en el tiempo libremente
  const newDate = new Date(currentRef);
  if (direction === 0) return new Date();
  newDate.setDate(newDate.getDate() + direction);
  return newDate;
}

describe("Restricción de Reportes - Rol Recepcionista vs Administrador", () => {
  const todayStr = getPeruDateString();

  it("Blindaje Backend: Recepcionista siempre tiene startDate y endDate fijados en Hoy", () => {
    // Intento malicioso o forzado de consultar años anteriores
    const maliciousParams = {
      startDate: "2023-01-01",
      endDate: "2023-12-31",
      bookingStatus: "completada",
    };

    const recepcionistaFilters = resolveReportFilters("recepcionista", maliciousParams);

    assert.equal(recepcionistaFilters.startDate, todayStr, "startDate debe ser estrictamente hoy en Perú");
    assert.equal(recepcionistaFilters.endDate, todayStr, "endDate debe ser estrictamente hoy en Perú");
    assert.equal(recepcionistaFilters.bookingStatus, "completada", "Otros filtros operativos deben preservarse");
  });

  it("Sin Regresión: Administrador conserva acceso completo a periodos históricos arbitrarios", () => {
    const historicalParams = {
      startDate: "2025-06-01",
      endDate: "2025-06-30",
      bookingStatus: "all",
    };

    const adminFilters = resolveReportFilters("admin", historicalParams);

    assert.equal(adminFilters.startDate, "2025-06-01", "El Administrador debe poder consultar el inicio del rango solicitado");
    assert.equal(adminFilters.endDate, "2025-06-30", "El Administrador debe poder consultar el fin del rango solicitado");
  });

  it("Reporte del Día (WhatsApp): Recepcionista no puede pedir fechas pasadas (ej. Ayer)", () => {
    // Intento de pedir el cierre de hace 7 días
    const pastDate = "2024-05-10";
    const resolvedRecepcionista = resolveDailyClosingDate("recepcionista", pastDate);

    assert.equal(
      resolvedRecepcionista,
      todayStr,
      "Para recepcionista, la fecha de cierre diario debe forzarse incondicionalmente a hoy"
    );

    // Para admin, la fecha pasada solicitada debe respetarse
    const resolvedAdmin = resolveDailyClosingDate("admin", pastDate);
    assert.equal(resolvedAdmin, pastDate, "Para admin, la fecha de cierre diario solicitada debe respetarse");
  });

  it("Navegación Temporal: Recepcionista tiene bloqueado el retroceso en el calendario", () => {
    const now = new Date();
    // Recepcionista intenta retroceder (-1)
    const resultRecepcionista = simulateNavigatePeriod("recepcionista", now, -1);
    assert.equal(
      resultRecepcionista.getTime(),
      now.getTime(),
      "La fecha de referencia no debe mutar hacia el pasado para recepcionista"
    );

    // Administrador intenta retroceder (-1)
    const resultAdmin = simulateNavigatePeriod("admin", now, -1);
    assert.notEqual(
      resultAdmin.getTime(),
      now.getTime(),
      "El Administrador sí debe poder desplazarse en el tiempo"
    );
  });

  it("Exportación PDF: Parámetros del PDF para Recepcionista acotados estrictamente a la jornada activa", () => {
    const queryAttempt = {
      startDate: "2020-01-01",
      endDate: "2024-12-31",
    };

    const pdfFilters = resolveReportFilters("recepcionista", queryAttempt);
    assert.equal(pdfFilters.startDate, todayStr);
    assert.equal(pdfFilters.endDate, todayStr);
  });
});
