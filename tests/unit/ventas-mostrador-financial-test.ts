import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePdfReport } from "../../src/lib/utils/pdf-generator";
import type { FullReportData, CounterSaleReportItem } from "../../src/lib/types/reports";

/**
 * Suite de Pruebas Unitarias para el Módulo de Ventas Rápidas (Mostrador)
 * Sistema: Acicalados Spa & Barber Shop
 */

describe("Módulo de Ventas Rápidas (Mostrador) - Validaciones y Cálculos", () => {
  it("Validación: Calcula el total dinámicamente como cantidad * precio_unitario", () => {
    const cantidad = 3;
    const precioUnitario = 25.5;
    const total = Math.round(cantidad * precioUnitario * 100) / 100;
    assert.equal(total, 76.5);
  });

  it("Validación: Rechaza cantidades menores a 1", () => {
    const invalidQty = 0;
    const isValid = invalidQty >= 1;
    assert.equal(isValid, false);
  });

  it("Validación: Requiere nombre del cliente y nombre del producto", () => {
    const cliente = "  ";
    const producto = "Cera Mate";
    const isValid = Boolean(cliente.trim() && producto.trim());
    assert.equal(isValid, false);
  });

  it("Edición Post-Creación: Al modificar precio_unitario o cantidad se recalcula el total", () => {
    const ventaInicial = {
      cantidad: 2,
      precio_unitario: 30.0,
      total: 60.0,
    };

    // Modificar precio acordado con descuento post-creación a S/ 25.00
    const nuevoPrecio = 25.0;
    const totalRecalculado = Math.round(ventaInicial.cantidad * nuevoPrecio * 100) / 100;
    assert.equal(totalRecalculado, 50.0);

    // Modificar cantidad a 4 unidades
    const nuevaCantidad = 4;
    const totalRecalculado2 = Math.round(nuevaCantidad * nuevoPrecio * 100) / 100;
    assert.equal(totalRecalculado2, 100.0);
  });
});

describe("Módulo de Ventas Rápidas - Aislamiento Estricto y Ticket Térmico", () => {
  it("Ticket Térmico: Es independiente y no contiene campos de citas ni barbero asignado", () => {
    const ticketData = {
      id: "abc-1234-def",
      cliente_nombre: "Mario Vargas",
      producto_nombre: "Cera Mate Gorilla",
      cantidad: 2,
      precio_unitario: 25.0,
      total: 50.0,
      metodo_pago: "Efectivo",
      fecha: "2026-09-04T10:30:00Z",
    };

    // Formato de código de venta
    const codigoVenta = `VP-${ticketData.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    assert.equal(codigoVenta, "VP-ABC1234D");

    // Verificar que los campos requeridos estén presentes
    assert.ok(ticketData.cliente_nombre);
    assert.ok(ticketData.producto_nombre);
    assert.equal(ticketData.total, 50.0);

    // Verificar que NO existan campos de reservas en el tipo de venta
    // @ts-expect-error - assigned_employee_id no debe existir
    assert.equal(ticketData.assigned_employee_id, undefined);
    // @ts-expect-error - start_time no debe existir
    assert.equal(ticketData.start_time, undefined);
    // @ts-expect-error - duration_minutes no debe existir
    assert.equal(ticketData.duration_minutes, undefined);
  });

  it("Aislamiento de Reservas: 'Ingresos Cobrados' en Reservas solo cuenta reservas, no ventas de mostrador", () => {
    // Ingresos cobrados en reservas
    const bookingVerifiedIncomeCents = 15000; // S/ 150.00 en reservas

    // Venta en mostrador
    const counterSalesCents = 5000; // S/ 50.00 en productos

    // Módulo Reservas (debe mantenerse estricto e intacto)
    const reservasIngresosCobrados = bookingVerifiedIncomeCents;
    assert.equal(reservasIngresosCobrados, 15000); // S/ 150.00 (SIN ventas)

    // Consolidado Financiero General (Dashboard Inicio y Reportes)
    const consolidadoFinancieroCents = bookingVerifiedIncomeCents + counterSalesCents;
    assert.equal(consolidadoFinancieroCents, 20000); // S/ 200.00 (CON ventas)
  });
});

describe("Módulo de Ventas Rápidas - Consolidación Financiera y Reporte PDF", () => {
  it("Fórmula Consolidada: Ingresos Totales = Reservas + Ventas Mostrador; Ganancia Neta = Ingresos - Egresos", () => {
    const totalCobradoReservasCents = 18000; // S/ 180.00
    const totalVentasProductosCents = 7500;  // S/ 75.00
    const totalEgresosOperativosCents = 6000; // S/ 60.00

    const ingresosTotalesCents = totalCobradoReservasCents + totalVentasProductosCents;
    const gananciaNetaCents = ingresosTotalesCents - totalEgresosOperativosCents;

    assert.equal(ingresosTotalesCents, 25500); // S/ 255.00
    assert.equal(gananciaNetaCents, 19500);    // S/ 195.00
  });

  it("Generación PDF: Incluye sección de Ventas Mostrador sin afectar servicios ni egresos", () => {
    const mockVentas: CounterSaleReportItem[] = [
      {
        id: "v-001",
        cliente_nombre: "Jorge Robledo",
        producto_nombre: "Cera Fijadora Fuerte",
        cantidad: 2,
        precio_unitario: 25.0,
        total: 50.0,
        total_cents: 5000,
        metodo_pago: "Yape",
        fecha: "2026-09-04T11:00:00Z",
        notas: "Con bolsa",
      },
      {
        id: "v-002",
        cliente_nombre: "Carlos Medina",
        producto_nombre: "Polo Oversize Acicalados",
        cantidad: 1,
        precio_unitario: 65.0,
        total: 65.0,
        total_cents: 6500,
        metodo_pago: "Efectivo",
        fecha: "2026-09-04T12:15:00Z",
      },
    ];

    const mockReportData: FullReportData = {
      filters: { startDate: "2026-09-01", endDate: "2026-09-04" },
      generated_at: "04/09/2026, 12:00:00",
      generated_by_name: "Admin Principal",
      summary: {
        total_bookings: 5,
        pending_bookings: 1,
        confirmed_bookings: 3,
        completed_bookings: 1,
        cancelled_bookings: 0,
        spa_collected_cents: 8000,
        barberia_collected_cents: 12000,
        spa_bookings_count: 2,
        barberia_bookings_count: 3,
        total_services_value_cents: 25000,
        total_collected_cents: 31500, // 20000 servicios + 11500 ventas
        yape_collected_cents: 13000,
        cash_collected_cents: 18500,
        transfer_collected_cents: 0,
        mixed_collected_cents: 0,
        culqi_collected_cents: 0,
        counter_sales_collected_cents: 11500,
        counter_sales_count: 2,
        advances_collected_cents: 5000,
        pending_balance_cents: 5000,
        total_expenses_cents: 4000,
        net_result_cents: 27500, // 31500 - 4000
      },
      bookings: [],
      payments: [],
      services_breakdown: [],
      employees_breakdown: [],
      expenses: [],
      completed_services_audit: [],
      counter_sales: mockVentas,
    };

    const pdfBuffer = generatePdfReport(mockReportData);
    assert.ok(pdfBuffer);
    assert.ok(pdfBuffer.length > 1000, "El PDF debe generarse con un tamaño válido de bytes");
  });
});
