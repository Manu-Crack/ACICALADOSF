import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildFullReportData } from "../../src/lib/services/report-service";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

const supabaseUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"]!;
const supabaseKey = envVars["SUPABASE_SERVICE_ROLE_KEY"]!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function runTimezoneReportVerification() {
  console.log("\n==========================================================================");
  console.log(" 🕒 VERIFICACIÓN INTEGRAL: ZONA HORARIA PERÚ (UTC-5) EN REPORTES");
  console.log("==========================================================================\n");

  // 1. Reporte para el 05 de Septiembre de 2026 (Ayer)
  console.log("1. Evaluando reporte del 2026-09-05 (Jornada anterior)...");
  const reportSept5 = await buildFullReportData(
    adminClient,
    { startDate: "2026-09-05", endDate: "2026-09-05" },
    "Test Auditor"
  );

  const salesSept5 = reportSept5.counter_sales || [];
  const salesCount5 = reportSept5.summary.counter_sales_count;
  const salesTotalCents5 = reportSept5.summary.counter_sales_collected_cents || 0;

  console.log(`   - Productos vendidos en resumen: ${salesCount5}`);
  console.log(`   - Productos en lista detallada: ${salesSept5.length}`);
  console.log(`   - Monto recaudado en mostrador: S/ ${(salesTotalCents5 / 100).toFixed(2)}`);

  const sulmaSales5 = salesSept5.filter((s) => s.cliente_nombre.toLowerCase().includes("sulma"));
  console.log(`   - Ventas de Sulma registradas en 2026-09-05: ${sulmaSales5.length}`);

  if (salesSept5.length !== 8) {
    throw new Error(`FALLO: Se esperaban 8 ventas en Sept 5, pero se obtuvieron ${salesSept5.length}`);
  }
  if (salesTotalCents5 !== 81700) {
    throw new Error(`FALLO: Se esperaba S/ 817.00 en Sept 5, pero se obtuvo S/ ${(salesTotalCents5 / 100).toFixed(2)}`);
  }
  if (sulmaSales5.length !== 3) {
    throw new Error(`FALLO: Se esperaban 3 ventas de Sulma en Sept 5, pero se obtuvieron ${sulmaSales5.length}`);
  }
  console.log("   ✅ [PASS] Sept 5 computa exactamente las 8 ventas (S/ 817.00) incluyendo las 3 ventas nocturnas de Sulma.");

  // 2. Reporte para el 06 de Septiembre de 2026 (Hoy)
  console.log("\n2. Evaluando reporte del 2026-09-06 (Jornada activa de hoy)...");
  const reportSept6 = await buildFullReportData(
    adminClient,
    { startDate: "2026-09-06", endDate: "2026-09-06" },
    "Test Auditor"
  );

  const salesSept6 = reportSept6.counter_sales || [];
  const salesCount6 = reportSept6.summary.counter_sales_count || 0;
  const salesTotalCents6 = reportSept6.summary.counter_sales_collected_cents || 0;

  console.log(`   - Productos vendidos en resumen: ${salesCount6}`);
  console.log(`   - Productos en lista detallada: ${salesSept6.length}`);
  console.log(`   - Monto recaudado en mostrador: S/ ${(salesTotalCents6 / 100).toFixed(2)}`);

  const sulmaSales6 = salesSept6.filter((s) => s.cliente_nombre.toLowerCase().includes("sulma"));
  console.log(`   - Ventas de Sulma filtradas en 2026-09-06: ${sulmaSales6.length}`);

  if (salesSept6.length !== 0) {
    throw new Error(`FALLO: Se esperaban 0 ventas en Sept 6 al iniciar el día, pero se obtuvieron ${salesSept6.length}`);
  }
  if (salesTotalCents6 !== 0) {
    throw new Error(`FALLO: Se esperaba S/ 0.00 en Sept 6, pero se obtuvo S/ ${(salesTotalCents6 / 100).toFixed(2)}`);
  }
  if (sulmaSales6.length !== 0) {
    throw new Error(`FALLO: Las ventas de Sulma NO deben aparecer en Sept 6. Aparecieron ${sulmaSales6.length}`);
  }
  console.log("   ✅ [PASS] Sept 6 inicia estrictamente en 0 productos vendidos y S/ 0.00 recaudados.");

  console.log("\n==========================================================================");
  console.log(" 🏁 RESULTADO: 100% DE VERIFICACIONES DE ZONA HORARIA SUPERADAS");
  console.log("==========================================================================\n");
}

runTimezoneReportVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
