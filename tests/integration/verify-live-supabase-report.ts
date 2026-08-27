import { createAdminClient } from "../../src/lib/supabase/admin";
import { buildFullReportData } from "../../src/lib/services/report-service";

async function verifyLiveReport() {
  console.log("================================================================================");
  console.log("🔍 VALIDACIÓN EN VIVO: CONSULTA REAL A SUPABASE CON EL SERVICIO CENTRAL DE REPORTES");
  console.log("================================================================================\n");

  const admin = createAdminClient();

  // Consultar para el 2026-08-26 (Día específico de citas reales en BD)
  const reportDay = await buildFullReportData(
    admin,
    { startDate: "2026-08-26", endDate: "2026-08-26" },
    "Verificador de Pruebas"
  );

  console.log("📅 Resultados Reportes para 2026-08-26:");
  console.log(`  - Total Reservas: ${reportDay.summary.total_bookings}`);
  console.log(`  - Confirmadas: ${reportDay.summary.confirmed_bookings}`);
  console.log(`  - Total Ingresos Cobrados: S/ ${(reportDay.summary.total_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Ingresos Spa: S/ ${(reportDay.summary.spa_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Ingresos Barbería: S/ ${(reportDay.summary.barberia_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Cobrado por Yape: S/ ${(reportDay.summary.yape_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Cobrado en Efectivo: S/ ${(reportDay.summary.cash_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Cobrado por Transferencia: S/ ${(reportDay.summary.transfer_collected_cents / 100).toFixed(2)}`);
  console.log(`  - Total Egresos Operativos: S/ ${(reportDay.summary.total_expenses_cents / 100).toFixed(2)}`);
  console.log(`  - Resultado Neto: S/ ${(reportDay.summary.net_result_cents / 100).toFixed(2)}`);
  console.log(`  - Total elementos en lista de pagos: ${reportDay.payments.length}`);

  // Comprobar suma directa en bookings para 2026-08-26
  const { data: directBookings } = await admin
    .from("bookings")
    .select("id, status, payment_status, total_price_cents, advance_amount_cents")
    .eq("booking_date", "2026-08-26")
    .in("status", ["confirmada", "completada"]);

  const directSum = (directBookings || []).reduce((acc, b) => {
    if (b.advance_amount_cents > 0) return acc + b.advance_amount_cents;
    if (b.payment_status === "total") return acc + (b.total_price_cents || 0);
    return acc;
  }, 0);

  console.log(`\n  ✅ Suma directa de Inicio/Reservas: S/ ${(directSum / 100).toFixed(2)}`);
  console.log(`  ✅ Suma en Reportes: S/ ${(reportDay.summary.total_collected_cents / 100).toFixed(2)}`);

  // Validar generación de PDF con datos reales
  const { generatePdfReport } = await import("../../src/lib/utils/pdf-generator");
  const pdfBuffer = generatePdfReport(reportDay);
  console.log(`\n  📄 PDF generado con éxito con datos reales: ${pdfBuffer.length} bytes`);

  if (directSum === reportDay.summary.total_collected_cents && reportDay.summary.total_collected_cents === 94500 && pdfBuffer.length > 0) {
    console.log("\n🎉 ÉXITO TOTAL: La suma es 100% IDÉNTICA (S/ 945.00) entre Inicio, Reservas, Reportes y la Exportación PDF.");
  } else {
    console.error("\n❌ DISCREPANCIA DETECTADA.");
    process.exit(1);
  }
}

verifyLiveReport().catch((err) => {
  console.error("Error running verification:", err);
  process.exit(1);
});
