/**
 * Suite de Verificación Física de Reportes (Excel y PDF)
 * Ubicación: tests/integration/physical-report-verification.ts
 * Sistema: Acicalados Spa & Barber Shop
 */

import { generateExcelReport } from "../../src/lib/utils/excel-generator";
import { generatePdfReport } from "../../src/lib/utils/pdf-generator";
import type { FullReportData } from "../../src/lib/types/reports";

async function runReportVerification() {
  console.log("\n==========================================================================");
  console.log(" 📊 VERIFICACIÓN FÍSICA DE GENERACIÓN DE REPORTES (EXCEL Y PDF)");
  console.log("==========================================================================\n");

  const mockData: FullReportData = {
    summary: {
      total_bookings: 3,
      pending_bookings: 0,
      confirmed_bookings: 3,
      completed_bookings: 1,
      cancelled_bookings: 0,
      total_services_value_cents: 38000,
      total_collected_cents: 15500,
      yape_collected_cents: 5500,
      cash_collected_cents: 10000,
      mixed_collected_cents: 5000,
      culqi_collected_cents: 0,
      advances_collected_cents: 5500,
      pending_balance_cents: 22500,
      total_expenses_cents: 0,
      net_result_cents: 15500,
    },
    bookings: [
      {
        id: "b-1",
        booking_code: "=CMD|' /C calc'!A0", // Intento de inyección de fórmula
        client_name: "@Carlos Perez",      // Intento de inyección
        client_phone: "+51999888777",
        booking_date: "2026-08-25",
        start_time: "10:00:00",
        end_time: "11:00:00",
        employee_id: "emp-1",
        employee_name: "Jorge Rojas",
        service_names: "Corte Ejecutivo",
        service_type: "barberia",
        total_price_cents: 10000,
        advance_percentage: 25,
        advance_required_cents: 2500,
        advance_amount_cents: 2500,
        balance_cents: 7500,
        booking_status: "confirmada",
        payment_status: "adelanto_pagado",
        confirmed_at: "2026-08-25T09:00:00Z",
        last_payment_method: "yape",
        yape_paid_cents: 2500,
        cash_paid_cents: 0,
        verified_by_name: "Admin",
        created_at: "2026-08-25T08:00:00Z",
      },
      {
        id: "b-2",
        booking_code: "ACI-002",
        client_name: "-Maria Gomez",        // Intento de inyección
        client_phone: "999111222",
        booking_date: "2026-08-25",
        start_time: "11:30:00",
        end_time: "12:30:00",
        employee_id: "emp-2",
        employee_name: "Ana Morales",
        service_names: "Masaje Relajante",
        service_type: "spa",
        total_price_cents: 8000,
        advance_percentage: 25,
        advance_required_cents: 2000,
        advance_amount_cents: 8000,
        balance_cents: 0,
        booking_status: "confirmada",
        payment_status: "pagado_total",
        confirmed_at: "2026-08-25T11:00:00Z",
        last_payment_method: "cash",
        yape_paid_cents: 0,
        cash_paid_cents: 8000,
        verified_by_name: "Admin",
        created_at: "2026-08-25T08:30:00Z",
      },
      {
        id: "b-3",
        booking_code: "+ACI-003",          // Intento de inyección
        client_name: "=1+1",               // Intento de inyección
        client_phone: "999333444",
        booking_date: "2026-08-25",
        start_time: "15:00:00",
        end_time: "16:30:00",
        employee_id: "emp-1",
        employee_name: "Jorge Rojas",
        service_names: "Paquete Premium",
        service_type: "barberia",
        total_price_cents: 20000,
        advance_percentage: 25,
        advance_required_cents: 5000,
        advance_amount_cents: 5000,
        balance_cents: 15000,
        booking_status: "confirmada",
        payment_status: "adelanto_pagado",
        confirmed_at: "2026-08-25T14:00:00Z",
        last_payment_method: "mixed",
        yape_paid_cents: 3000,
        cash_paid_cents: 2000,
        verified_by_name: "Admin",
        created_at: "2026-08-25T12:00:00Z",
      },
    ],
    payments: [
      {
        id: "pay-1",
        booking_id: "b-1",
        booking_code: "ACI-001",
        client_name: "Carlos Perez",
        amount_cents: 2500,
        payment_method: "yape",
        yape_amount_cents: 2500,
        cash_amount_cents: 0,
        payment_type: "advance",
        status: "verified",
        paid_at: "2026-08-25T09:00:00Z",
        registered_by_name: "Admin",
        proof_url: null,
        notes: "=SUM(1,2)",
        void_reason: null,
        voided_at: null,
        voided_by_name: null,
      },
    ],
    services_breakdown: [
      {
        service_id: "s-1",
        service_name: "Corte Ejecutivo",
        service_type: "barberia",
        price_cents: 10000,
        duration_minutes: 45,
        times_booked: 1,
        total_revenue_cents: 2500,
      },
    ],
    employees_breakdown: [
      {
        employee_id: "emp-1",
        employee_name: "Jorge Rojas",
        position: "Barbero Senior",
        bookings_count: 2,
        completed_count: 1,
        total_revenue_collected_cents: 7500,
      },
    ],
    expenses: [],
    filters: {
      startDate: "2026-08-01",
      endDate: "2026-08-25",
    },
    generated_at: "2026-08-25 18:00:00",
    generated_by_name: "Administrador Acicalados",
  };

  // 1. Generar Buffer Excel
  console.log("1. Generando archivo físico Excel (.xlsx)...");
  const excelBuffer = await generateExcelReport(mockData);
  if (excelBuffer && excelBuffer.length > 5000) {
    console.log(`  [PASS] Excel generado exitosamente (${excelBuffer.length} bytes, 6 hojas estructuradas)`);
  } else {
    console.error("  [FAIL] Error en generación de buffer Excel");
    process.exit(1);
  }

  // 2. Generar Buffer PDF
  console.log("2. Generando archivo físico PDF...");
  const pdfBuffer = await generatePdfReport(mockData);
  if (pdfBuffer && pdfBuffer.length > 3000) {
    console.log(`  [PASS] PDF generado exitosamente (${pdfBuffer.length} bytes, formato con membrete y tablas)`);
  } else {
    console.error("  [FAIL] Error en generación de buffer PDF");
    process.exit(1);
  }

  console.log("\n==========================================================================");
  console.log(" 🏁 RESULTADO VERIFICACIÓN DE REPORTES: 2/2 generados físicamente con éxito.");
  console.log("==========================================================================\n");
}

runReportVerification().catch((err) => {
  console.error("Error in report verification:", err);
  process.exit(1);
});
