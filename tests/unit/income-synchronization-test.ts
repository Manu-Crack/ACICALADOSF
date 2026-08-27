import { calculateValidIncomeForBooking, FinancialBooking } from "../../src/app/dashboard/DashboardHome";
import {
  calculateValidIncomeForBooking as reportCalculateIncome,
  normalizePaymentMethod,
  matchesPaymentMethodFilter,
} from "../../src/lib/services/report-service";

function runTests() {
  console.log("================================================================================");
  console.log("🧪 INICIO DE TEST DE SINCRONIZACIÓN DE INGRESOS (INICIO VS RESERVAS VS REPORTES)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASÓ: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FALLÓ: ${msg}`);
      failed++;
    }
  }

  // 1. Reserva confirmada con pago total
  const b1: FinancialBooking = {
    id: "1",
    booking_code: "B001",
    client_first_name: "MIRTA",
    client_last_name: "Presencial",
    start_time: "14:45",
    status: "confirmada",
    payment_status: "total",
    service_type: "barberia",
    booking_date: "2026-08-26",
    total_price_cents: 3500,
    advance_amount_cents: 3500,
    balance_cents: 0,
  };
  assert(calculateValidIncomeForBooking(b1) === 3500, "Reserva confirmada con pago total S/ 35.00 retorna 3500 centavos en Inicio");
  assert(reportCalculateIncome(b1) === 3500, "Reserva confirmada con pago total S/ 35.00 retorna 3500 centavos en Reportes");

  // 2. Reserva confirmada con pago parcial (adelanto verificado)
  const b2: FinancialBooking = {
    id: "2",
    booking_code: "B002",
    client_first_name: "Carlos",
    client_last_name: "Cliente",
    start_time: "10:00",
    status: "confirmada",
    payment_status: "parcial",
    service_type: "spa",
    booking_date: "2026-08-26",
    total_price_cents: 10000,
    advance_amount_cents: 2500,
    balance_cents: 7500,
  };
  assert(calculateValidIncomeForBooking(b2) === 2500, "Reserva confirmada con pago parcial S/ 25.00 retorna 2500 centavos en Inicio");
  assert(reportCalculateIncome(b2) === 2500, "Reserva confirmada con pago parcial S/ 25.00 retorna 2500 centavos en Reportes");

  // 3. Reserva confirmada sin pago (walk-in registrado sin cobro previo)
  const b3: FinancialBooking = {
    id: "3",
    booking_code: "B003",
    client_first_name: "Pedro",
    client_last_name: "Mostrador",
    start_time: "11:00",
    status: "confirmada",
    payment_status: "sin_pago",
    service_type: "barberia",
    booking_date: "2026-08-26",
    total_price_cents: 4000,
    advance_amount_cents: 0,
    balance_cents: 4000,
  };
  assert(calculateValidIncomeForBooking(b3) === 0, "Reserva confirmada sin pago (sin_pago) retorna 0 centavos en Inicio");
  assert(reportCalculateIncome(b3) === 0, "Reserva confirmada sin pago (sin_pago) retorna 0 centavos en Reportes");

  // 4. Reserva pendiente (WhatsApp)
  const b4: FinancialBooking = {
    id: "4",
    booking_code: "B004",
    client_first_name: "Ana",
    client_last_name: "WhatsApp",
    start_time: "12:00",
    status: "pendiente",
    payment_status: "sin_pago",
    service_type: "spa",
    booking_date: "2026-08-26",
    total_price_cents: 8000,
    advance_amount_cents: 0,
    balance_cents: 8000,
  };
  assert(calculateValidIncomeForBooking(b4) === 0, "Reserva pendiente retorna 0 centavos");
  assert(reportCalculateIncome(b4) === 0, "Reserva pendiente retorna 0 centavos en Reportes");

  // 5. Reserva cancelada / expirada
  const b5: FinancialBooking = {
    id: "5",
    booking_code: "B005",
    client_first_name: "Expirado",
    client_last_name: "Antiguo",
    start_time: "15:00",
    status: "expirada",
    payment_status: "sin_pago",
    service_type: "barberia",
    booking_date: "2026-08-20",
    total_price_cents: 3500,
    advance_amount_cents: 1050,
    balance_cents: 2450,
  };
  assert(calculateValidIncomeForBooking(b5) === 0, "Reserva expirada retorna 0 centavos");
  assert(reportCalculateIncome(b5) === 0, "Reserva expirada retorna 0 centavos en Reportes");

  // 6. Normalización de métodos de pago
  assert(normalizePaymentMethod("cash") === "efectivo", "Método 'cash' normaliza a 'efectivo'");
  assert(normalizePaymentMethod("EFECTIVO") === "efectivo", "Método 'EFECTIVO' normaliza a 'efectivo'");
  assert(normalizePaymentMethod("transfer") === "transferencia", "Método 'transfer' normaliza a 'transferencia'");
  assert(normalizePaymentMethod("yape") === "yape", "Método 'yape' normaliza a 'yape'");
  assert(matchesPaymentMethodFilter("cash", "efectivo") === true, "Filtro 'efectivo' coincide con 'cash'");
  assert(matchesPaymentMethodFilter("transferencia", "transfer") === true, "Filtro 'transfer' coincide con 'transferencia'");

  // 7. Comparación de suma total entre Reservas, DashboardHome y Reportes
  const mockBookings: FinancialBooking[] = [b1, b2, b3, b4, b5];

  // Fórmula ReservasManager:
  const reservasCollectedRevenue = mockBookings
    .filter((b) => ["confirmada", "completada"].includes(b.status))
    .reduce((sum, b) => sum + (b.advance_amount_cents || 0), 0);

  // Fórmula DashboardHome:
  const dashboardValidBookings = mockBookings.filter((b) => calculateValidIncomeForBooking(b) > 0);
  const dashboardTotalIncome = dashboardValidBookings.reduce((sum, b) => sum + calculateValidIncomeForBooking(b), 0);

  // Fórmula ReportService:
  const reportTotalIncome = mockBookings.reduce((sum, b) => sum + reportCalculateIncome(b), 0);

  console.log(`\n  📊 Suma Reservas (totalCollectedRevenue): S/ ${(reservasCollectedRevenue / 100).toFixed(2)}`);
  console.log(`  📊 Suma Dashboard (totalIncomeCents): S/ ${(dashboardTotalIncome / 100).toFixed(2)}`);
  console.log(`  📊 Suma Reportes (total_collected_cents): S/ ${(reportTotalIncome / 100).toFixed(2)}`);

  assert(
    reservasCollectedRevenue === dashboardTotalIncome,
    `La suma total de Reservas (S/ ${(reservasCollectedRevenue / 100).toFixed(2)}) es idéntica a la de Inicio (S/ ${(dashboardTotalIncome / 100).toFixed(2)})`
  );

  assert(
    reportTotalIncome === dashboardTotalIncome,
    `La suma total de Reportes (S/ ${(reportTotalIncome / 100).toFixed(2)}) es 100% idéntica a la de Inicio y Reservas`
  );

  assert(
    dashboardValidBookings.length === 2,
    `Solo las 2 reservas confirmadas con cobro positivo aparecen en movimientos (B001 y B002)`
  );

  // 8. Validación de Balance Spa vs Barbería en Reportes
  let spaSum = 0;
  let barberiaSum = 0;
  mockBookings.forEach((b) => {
    const inc = reportCalculateIncome(b);
    if (b.service_type === "spa") spaSum += inc;
    else if (b.service_type === "barberia") barberiaSum += inc;
  });

  assert(
    spaSum + barberiaSum === reportTotalIncome,
    `La segmentación Spa (S/ ${(spaSum / 100).toFixed(2)}) + Barbería (S/ ${(barberiaSum / 100).toFixed(2)}) = S/ ${(reportTotalIncome / 100).toFixed(2)} sin pérdidas de centavos`
  );

  console.log("\n================================================================================");
  console.log(`🏁 RESULTADO: ${passed} pruebas pasadas, ${failed} fallidas`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
