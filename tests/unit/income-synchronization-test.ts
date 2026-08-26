import { calculateValidIncomeForBooking, FinancialBooking } from "../../src/app/dashboard/DashboardHome";

function runTests() {
  console.log("================================================================================");
  console.log("🧪 INICIO DE TEST DE SINCRONIZACIÓN DE INGRESOS (INICIO VS RESERVAS)");
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
  assert(calculateValidIncomeForBooking(b1) === 3500, "Reserva confirmada con pago total S/ 35.00 retorna 3500 centavos");

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
  assert(calculateValidIncomeForBooking(b2) === 2500, "Reserva confirmada con pago parcial S/ 25.00 retorna 2500 centavos (no el total ni un % inventado)");

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
  assert(calculateValidIncomeForBooking(b3) === 0, "Reserva confirmada sin pago (sin_pago) retorna 0 centavos");

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

  // 6. Comparación de suma total entre Reservas y DashboardHome
  const mockBookings: FinancialBooking[] = [b1, b2, b3, b4, b5];

  // Fórmula ReservasManager:
  const reservasCollectedRevenue = mockBookings
    .filter((b) => ["confirmada", "completada"].includes(b.status))
    .reduce((sum, b) => sum + (b.advance_amount_cents || 0), 0);

  // Fórmula DashboardHome:
  const dashboardValidBookings = mockBookings.filter((b) => calculateValidIncomeForBooking(b) > 0);
  const dashboardTotalIncome = dashboardValidBookings.reduce((sum, b) => sum + calculateValidIncomeForBooking(b), 0);

  console.log(`\n  📊 Suma Reservas (totalCollectedRevenue): S/ ${(reservasCollectedRevenue / 100).toFixed(2)}`);
  console.log(`  📊 Suma Dashboard (totalIncomeCents): S/ ${(dashboardTotalIncome / 100).toFixed(2)}`);

  assert(
    reservasCollectedRevenue === dashboardTotalIncome,
    `La suma total de Reservas (S/ ${(reservasCollectedRevenue / 100).toFixed(2)}) es idéntica a la de Inicio (S/ ${(dashboardTotalIncome / 100).toFixed(2)})`
  );

  assert(
    dashboardValidBookings.length === 2,
    `Solo las 2 reservas confirmadas con cobro positivo aparecen en movimientos (B001 y B002)`
  );

  console.log("\n================================================================================");
  console.log(`🏁 RESULTADO: ${passed} pruebas pasadas, ${failed} fallidas`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
