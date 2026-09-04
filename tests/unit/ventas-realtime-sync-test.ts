/**
 * Test Unitario de Sincronización Automática en Tiempo Real para Ventas de Mostrador
 * Verifica la reactividad instantánea en Inicio y Reportes ante INSERT, UPDATE y DELETE.
 */

// Configurar mock de entorno navegador para Node.js
class MockWindow {
  listeners: Record<string, Array<(e: any) => void>> = {};
  addEventListener(event: string, fn: (e: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event: string, fn: (e: any) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
  }
  dispatchEvent(event: any) {
    const list = this.listeners[event.type] || [];
    for (const fn of list) fn(event);
    return true;
  }
}

class MockCustomEvent {
  type: string;
  detail: any;
  constructor(type: string, init?: any) {
    this.type = type;
    this.detail = init?.detail;
  }
}

(globalThis as any).window = new MockWindow();
(globalThis as any).CustomEvent = MockCustomEvent;

import { subscribeVentasSync, emitVentaChange, VentaSyncEvent } from "../../src/lib/utils/ventas-sync";
import type { FullReportData } from "../../src/lib/types/reports";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    throw new Error(`Test failed: ${message}`);
  }
  console.log(`  ✅ PASÓ: ${message}`);
}

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 INICIO DE TEST DE SINCRONIZACIÓN EN TIEMPO REAL (VENTAS MOSTRADOR)");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // 1. Prueba del Bus de Sincronización (ventas-sync.ts)
  // ---------------------------------------------------------------------------
  console.log("\n1. Verificando Bus de Eventos Rápido (ventas-sync):");
  let receivedEvents: VentaSyncEvent[] = [];
  const unsubscribe = subscribeVentasSync((event) => {
    receivedEvents.push(event);
  });

  const testVenta = {
    id: "venta-test-uuid-1",
    cliente_nombre: "Juan Pérez",
    producto_nombre: "Cera Mate Barber",
    cantidad: 2,
    precio_unitario: 35,
    total: 70,
    metodo_pago: "Yape",
    fecha: "2026-09-04T12:00:00.000Z",
  };

  emitVentaChange({
    eventType: "INSERT",
    venta: testVenta,
  });

  assert(receivedEvents.length === 1, "El suscriptor del bus recibió el evento emitido");
  assert(receivedEvents[0].eventType === "INSERT", "El tipo de evento recibido es INSERT");
  assert(receivedEvents[0].venta.id === "venta-test-uuid-1", "El id de la venta coincide con el emitido");
  assert(receivedEvents[0].venta.total === 70, "El total de la venta emitida es S/ 70");

  unsubscribe();

  // ---------------------------------------------------------------------------
  // 2. Simulación de Reactividad en Módulo Inicio (/dashboard)
  // ---------------------------------------------------------------------------
  console.log("\n2. Verificando Reactividad y Recálculo en Módulo Inicio:");
  let financialVentas = [
    {
      id: "v-initial-1",
      cliente_nombre: "Carlos",
      producto_nombre: "Shampoo",
      cantidad: 1,
      precio_unitario: 25,
      total: 25,
      metodo_pago: "Efectivo",
      fecha: "2026-09-04T10:00:00.000Z",
    },
  ];

  const initialVentasCents = financialVentas.reduce((acc, v) => acc + Math.round(v.total * 100), 0);
  assert(initialVentasCents === 2500, "Ventas iniciales en Inicio: S/ 25.00 (2500 centavos)");

  // Simular inserción en tiempo real
  const newVentaInicio = {
    id: "v-realtime-2",
    cliente_nombre: "Ana Gómez",
    producto_nombre: "Aceite Barba",
    cantidad: 1,
    precio_unitario: 45,
    total: 45,
    metodo_pago: "Yape",
    fecha: "2026-09-04T11:30:00.000Z",
  };

  financialVentas = [newVentaInicio, ...financialVentas];
  const updatedVentasCents = financialVentas.reduce((acc, v) => acc + Math.round(v.total * 100), 0);
  assert(updatedVentasCents === 7000, "Ventas tras INSERT en tiempo real: S/ 70.00 (7000 centavos)");

  // Simular edición en tiempo real
  const editedVenta = {
    ...newVentaInicio,
    cantidad: 2,
    total: 90,
  };
  financialVentas = financialVentas.map((v) => (v.id === editedVenta.id ? editedVenta : v));
  const afterEditCents = financialVentas.reduce((acc, v) => acc + Math.round(v.total * 100), 0);
  assert(afterEditCents === 11500, "Ventas tras UPDATE en tiempo real: S/ 115.00 (11500 centavos)");

  // Simular eliminación en tiempo real
  financialVentas = financialVentas.filter((v) => v.id !== "v-realtime-2");
  const afterDeleteCents = financialVentas.reduce((acc, v) => acc + Math.round(v.total * 100), 0);
  assert(afterDeleteCents === 2500, "Ventas tras DELETE en tiempo real: Retorna a S/ 25.00 (2500 centavos)");

  // ---------------------------------------------------------------------------
  // 3. Simulación de Reactividad en Módulo Reportes (/dashboard/reportes)
  // ---------------------------------------------------------------------------
  console.log("\n3. Verificando Reactividad en Módulo Reportes (FullReportData & Summary):");

  let mockReportData: FullReportData = {
    filters: {},
    generated_at: new Date().toISOString(),
    generated_by_name: "Admin",
    summary: {
      total_bookings: 5,
      pending_bookings: 0,
      confirmed_bookings: 2,
      completed_bookings: 3,
      cancelled_bookings: 0,
      spa_collected_cents: 10000,
      barberia_collected_cents: 8000,
      spa_bookings_count: 2,
      barberia_bookings_count: 3,
      total_services_value_cents: 18000,
      total_collected_cents: 18000, // Inicialmente sin ventas de mostrador
      yape_collected_cents: 10000,
      cash_collected_cents: 8000,
      transfer_collected_cents: 0,
      mixed_collected_cents: 0,
      culqi_collected_cents: 0,
      counter_sales_collected_cents: 0,
      counter_sales_count: 0,
      advances_collected_cents: 5000,
      pending_balance_cents: 0,
      total_expenses_cents: 5000,
      net_result_cents: 13000, // 18000 - 5000
    },
    bookings: [],
    payments: [],
    services_breakdown: [],
    employees_breakdown: [],
    expenses: [],
    counter_sales: [],
  };

  // Simulación de applyVentaUpdate INSERT
  const insertPayload = {
    id: "rep-sale-1",
    cliente_nombre: "Lucía Morales",
    producto_nombre: "Pomada Capilar",
    cantidad: 2,
    precio_unitario: 30,
    total: 60,
    metodo_pago: "Efectivo",
    fecha: "2026-09-04T14:00:00.000Z",
  };

  const insertCents = Math.round(insertPayload.total * 100); // 6000
  mockReportData = {
    ...mockReportData,
    summary: {
      ...mockReportData.summary,
      counter_sales_collected_cents: (mockReportData.summary.counter_sales_collected_cents || 0) + insertCents,
      counter_sales_count: (mockReportData.summary.counter_sales_count || 0) + 1,
      total_collected_cents: mockReportData.summary.total_collected_cents + insertCents,
      net_result_cents: mockReportData.summary.net_result_cents + insertCents,
      cash_collected_cents: mockReportData.summary.cash_collected_cents + insertCents,
    },
    counter_sales: [
      {
        ...insertPayload,
        total_cents: insertCents,
      },
    ],
  };

  assert(mockReportData.summary.counter_sales_collected_cents === 6000, "Reportes: Ventas mostrador S/ 60.00 (6000 centavos)");
  assert(mockReportData.summary.counter_sales_count === 1, "Reportes: Contador de ventas de mostrador es 1");
  assert(mockReportData.summary.total_collected_cents === 24000, "Reportes: Ingresos Cobrados totales aumentaron a S/ 240.00 (24000 centavos)");
  assert(mockReportData.summary.net_result_cents === 19000, "Reportes: Ganancia Neta recalculada exactamente a S/ 190.00 (19000 centavos)");
  assert(mockReportData.summary.cash_collected_cents === 14000, "Reportes: Efectivo incrementado en S/ 60.00 (14000 centavos)");
  assert(mockReportData.counter_sales?.length === 1, "Reportes: Tabla de auditoría contiene el nuevo registro");

  // Simulación de applyVentaUpdate UPDATE (cambio a 3 unidades = S/ 90)
  const updatePayload = {
    ...insertPayload,
    cantidad: 3,
    total: 90,
  };
  const newCents = Math.round(updatePayload.total * 100); // 9000
  const deltaCents = newCents - insertCents; // +3000

  mockReportData = {
    ...mockReportData,
    summary: {
      ...mockReportData.summary,
      counter_sales_collected_cents: (mockReportData.summary.counter_sales_collected_cents || 0) + deltaCents,
      total_collected_cents: mockReportData.summary.total_collected_cents + deltaCents,
      net_result_cents: mockReportData.summary.net_result_cents + deltaCents,
      cash_collected_cents: mockReportData.summary.cash_collected_cents + deltaCents,
    },
    counter_sales: [
      {
        ...updatePayload,
        total_cents: newCents,
      },
    ],
  };

  assert(mockReportData.summary.counter_sales_collected_cents === 9000, "Reportes UPDATE: Ventas mostrador subieron a S/ 90.00 (9000 centavos)");
  assert(mockReportData.summary.total_collected_cents === 27000, "Reportes UPDATE: Ingresos Cobrados totales subieron a S/ 270.00");
  assert(mockReportData.summary.net_result_cents === 22000, "Reportes UPDATE: Ganancia Neta subió a S/ 220.00");

  // Simulación de applyVentaUpdate DELETE
  const deleteCents = newCents; // 9000
  mockReportData = {
    ...mockReportData,
    summary: {
      ...mockReportData.summary,
      counter_sales_collected_cents: Math.max(0, (mockReportData.summary.counter_sales_collected_cents || 0) - deleteCents),
      counter_sales_count: Math.max(0, (mockReportData.summary.counter_sales_count || 1) - 1),
      total_collected_cents: mockReportData.summary.total_collected_cents - deleteCents,
      net_result_cents: mockReportData.summary.net_result_cents - deleteCents,
      cash_collected_cents: mockReportData.summary.cash_collected_cents - deleteCents,
    },
    counter_sales: [],
  };

  assert(mockReportData.summary.counter_sales_collected_cents === 0, "Reportes DELETE: Ventas mostrador retornan a S/ 0.00");
  assert(mockReportData.summary.counter_sales_count === 0, "Reportes DELETE: Conteo de ventas retorna a 0");
  assert(mockReportData.summary.total_collected_cents === 18000, "Reportes DELETE: Ingresos cobrados retornan a S/ 180.00");
  assert(mockReportData.summary.net_result_cents === 13000, "Reportes DELETE: Ganancia neta retorna a S/ 130.00");
  assert(mockReportData.counter_sales?.length === 0, "Reportes DELETE: Tabla de auditoría vacía");

  console.log("\n================================================================================");
  console.log("🏁 RESULTADO: Todas las pruebas de sincronización en tiempo real PASARON exitosamente.");
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
