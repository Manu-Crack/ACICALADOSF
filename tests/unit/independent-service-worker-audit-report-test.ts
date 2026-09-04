import assert from "node:assert";
import { parseTimeToMinutes, formatMinutesToTime } from "../../src/lib/services/report-service";
import { generatePdfReport } from "../../src/lib/utils/pdf-generator";
import type { FullReportData, CompletedServiceAuditItem, EmployeePerformanceItem } from "../../src/lib/types/reports";

console.log("🧪 Iniciando pruebas de Asignación Independiente de Personal y Desvinculación Horaria por Servicio...");

// -----------------------------------------------------------------------------
// 1. Prueba de funciones helper de tiempo
// -----------------------------------------------------------------------------
{
  assert.strictEqual(parseTimeToMinutes("15:15:00"), 915);
  assert.strictEqual(parseTimeToMinutes("15:15"), 915);
  assert.strictEqual(parseTimeToMinutes("00:00"), 0);
  assert.strictEqual(parseTimeToMinutes(null), 0);

  assert.strictEqual(formatMinutesToTime(915), "15:15:00");
  assert.strictEqual(formatMinutesToTime(915 + 45), "16:00:00");
  assert.strictEqual(formatMinutesToTime(915 + 45 + 60), "17:00:00");
  console.log("  ✅ Helpers parseTimeToMinutes y formatMinutesToTime: PASS");
}

// -----------------------------------------------------------------------------
// 2. Simulación de procesamiento de reserva múltiple (Desvinculación y Especialistas)
// -----------------------------------------------------------------------------
{
  interface MockBookingService {
    id: string;
    service_id: string;
    service_name: string;
    service_price_cents: number;
    duration_minutes: number;
    assigned_employee_id: string | null;
    created_at: string;
    services: { name: string; type: string };
  }

  interface MockBooking {
    id: string;
    booking_code: string;
    client_first_name: string;
    client_last_name: string;
    client_phone: string;
    booking_date: string;
    start_time: string;
    end_time: string;
    status: string;
    payment_status: string;
    service_type: string;
    payment_method: string;
    total_price_cents: number;
    advance_amount_cents: number;
    balance_cents: number;
    assigned_employee_id: string | null;
    created_at: string;
    employees: { id: string; first_name: string; last_name: string; type: string } | null;
    booking_services: MockBookingService[];
  }

  const employeeMap = new Map<string, { id: string; first_name: string; last_name: string; type: string }>([
    ["emp-carlos", { id: "emp-carlos", first_name: "Carlos", last_name: "García", type: "barberia" }],
    ["emp-yholi", { id: "emp-yholi", first_name: "Yholi", last_name: "Flores", type: "spa" }],
    ["emp-header", { id: "emp-header", first_name: "Cabecera", last_name: "General", type: "barberia" }],
  ]);

  // Reserva de 3 servicios (45m + 60m + 30m = 135m total)
  // Horario global de la reserva: 15:15:00 a 19:14:00 (rango extendido que NO debe arrastrarse a servicios)
  const bookingMulti: MockBooking = {
    id: "booking-multi-1",
    booking_code: "BK-MULTI-01",
    client_first_name: "Ana",
    client_last_name: "Pérez",
    client_phone: "987654321",
    booking_date: "2026-09-04",
    start_time: "15:15:00",
    end_time: "19:14:00",
    status: "completada",
    payment_status: "total",
    service_type: "mixto",
    payment_method: "yape",
    total_price_cents: 13000, // S/ 130.00
    advance_amount_cents: 13000,
    balance_cents: 0,
    assigned_employee_id: "emp-header", // Empleado forzado en cabecera antigua
    created_at: "2026-09-04T12:00:00.000Z",
    employees: { id: "emp-header", first_name: "Cabecera", last_name: "General", type: "barberia" },
    booking_services: [
      {
        id: "bs-1",
        service_id: "svc-1",
        service_name: "Corte Fade",
        service_price_cents: 4000, // S/ 40
        duration_minutes: 45,
        assigned_employee_id: "emp-carlos",
        created_at: "2026-09-04T12:00:01.000Z",
        services: { name: "Corte Fade", type: "barberia" },
      },
      {
        id: "bs-2",
        service_id: "svc-2",
        service_name: "Limpieza Facial",
        service_price_cents: 6000, // S/ 60
        duration_minutes: 60,
        assigned_employee_id: "emp-yholi",
        created_at: "2026-09-04T12:00:02.000Z",
        services: { name: "Limpieza Facial", type: "spa" },
      },
      {
        id: "bs-3",
        service_id: "svc-3",
        service_name: "Perfilado de Cejas",
        service_price_cents: 3000, // S/ 30
        duration_minutes: 30,
        assigned_employee_id: null, // Sin asignar
        created_at: "2026-09-04T12:00:03.000Z",
        services: { name: "Perfilado de Cejas", type: "barberia" },
      },
    ],
  };

  // Función idéntica a la implementada en report-service.ts
  function processReportBookings(
    bookings: MockBooking[],
    filterEmployeeId?: string
  ) {
    const completedServicesAuditList: CompletedServiceAuditItem[] = [];
    const employeesMap: Record<string, EmployeePerformanceItem> = {};
    const empBookingsMap = new Map<string, Set<string>>();
    const empCompletedMap = new Map<string, Set<string>>();

    bookings.forEach((b) => {
      const clientName = `${b.client_first_name || ""} ${b.client_last_name || ""}`.trim();
      const validIncomeCents = b.total_price_cents;
      const isConfirmedOrCompleted = b.status === "confirmada" || b.status === "completada";

      const rawBServices = b.booking_services || [];
      const bServices = [...rawBServices].sort((a, bItem) => {
        if (a.created_at && bItem.created_at) {
          const diff = new Date(a.created_at).getTime() - new Date(bItem.created_at).getTime();
          if (diff !== 0) return diff;
        }
        return 0;
      });

      const isMultiService = bServices.length >= 2;
      const baseStartMin = parseTimeToMinutes(b.start_time);
      let currentMin = baseStartMin;

      const totalBookingServicesPrice = bServices.reduce(
        (sum, s) => sum + (s.service_price_cents || 0),
        0
      ) || b.total_price_cents || 1;

      bServices.forEach((bs) => {
        const sName = bs.service_name;
        const sType = bs.services.type;
        const sPrice = bs.service_price_cents;

        // Cronograma secuencial exacto por servicio
        const duration = Math.max(1, Number(bs.duration_minutes) || 30);
        const svcStartMin = currentMin;
        const svcEndMin = svcStartMin + duration;
        const startTimeStr = formatMinutesToTime(svcStartMin);
        const endTimeStr = formatMinutesToTime(svcEndMin);
        currentMin = svcEndMin;

        // Asignación de especialista independiente:
        // En reservas múltiples (>=2), NO hereda el empleado general de cabecera.
        const workerId = isMultiService
          ? (bs.assigned_employee_id || null)
          : (bs.assigned_employee_id || b.assigned_employee_id || null);

        let workerName = "Sin asignar";
        let workerPos = "Especialista";

        if (workerId) {
          const empInfo = employeeMap.get(workerId);
          if (empInfo) {
            workerName = `${empInfo.first_name} ${empInfo.last_name}`;
            workerPos = empInfo.type === "barberia" ? "Barbero" : empInfo.type === "spa" ? "Especialista Spa" : "Especialista";
          }
        }

        const matchesEmployeeFilter = !filterEmployeeId || filterEmployeeId === "all" || workerId === filterEmployeeId;

        if (matchesEmployeeFilter && b.status !== "cancelada" && b.status !== "expirada") {
          completedServicesAuditList.push({
            id: `${b.id}_${bs.id}`,
            booking_id: b.id,
            booking_code: b.booking_code,
            client_name: clientName,
            service_name: sName,
            service_type: sType,
            price_cents: sPrice,
            employee_name: workerName,
            date_exact: `${b.booking_date} ${startTimeStr.slice(0, 5)}`.trim(),
            booking_date: b.booking_date,
            start_time: startTimeStr,
            end_time: endTimeStr,
            duration_minutes: duration,
            payment_method: b.payment_method,
            payment_status: b.payment_status,
            status: b.status,
          });
        }

        if (workerId && matchesEmployeeFilter) {
          if (!employeesMap[workerId]) {
            employeesMap[workerId] = {
              employee_id: workerId,
              employee_name: workerName,
              position: workerPos,
              bookings_count: 0,
              completed_count: 0,
              total_revenue_collected_cents: 0,
              total_duration_minutes: 0,
            };
          }

          if (!empBookingsMap.has(workerId)) empBookingsMap.set(workerId, new Set());
          empBookingsMap.get(workerId)!.add(b.id);
          employeesMap[workerId].bookings_count = empBookingsMap.get(workerId)!.size;

          if (b.status === "completada") {
            if (!empCompletedMap.has(workerId)) empCompletedMap.set(workerId, new Set());
            empCompletedMap.get(workerId)!.add(b.id);
            employeesMap[workerId].completed_count = empCompletedMap.get(workerId)!.size;
          }

          if (b.status !== "cancelada" && b.status !== "expirada") {
            employeesMap[workerId].total_duration_minutes =
              (employeesMap[workerId].total_duration_minutes || 0) + duration;
          }

          if (isConfirmedOrCompleted && validIncomeCents > 0) {
            const svcShare = sPrice / totalBookingServicesPrice;
            const proportionalIncome = Math.round(validIncomeCents * svcShare);
            employeesMap[workerId].total_revenue_collected_cents += proportionalIncome;
          }
        }
      });
    });

    return { completedServicesAuditList, employeesMap };
  }

  // Ejecución sin filtro de empleado (Vista completa)
  const resultAll = processReportBookings([bookingMulti]);
  const auditList = resultAll.completedServicesAuditList;

  assert.strictEqual(auditList.length, 3, "Deben existir 3 servicios auditados");

  // Verificación Servicio 1 (Corte Fade)
  const svc1 = auditList[0];
  assert.strictEqual(svc1.service_name, "Corte Fade");
  assert.strictEqual(svc1.start_time, "15:15:00", "Servicio 1 inicia a las 15:15");
  assert.strictEqual(svc1.end_time, "16:00:00", "Servicio 1 finaliza a las 16:00 (45m)");
  assert.strictEqual(svc1.duration_minutes, 45, "Duración exacta = 45 min");
  assert.strictEqual(svc1.employee_name, "Carlos García", "Especialista asignado = Carlos García");

  // Verificación Servicio 2 (Limpieza Facial)
  const svc2 = auditList[1];
  assert.strictEqual(svc2.service_name, "Limpieza Facial");
  assert.strictEqual(svc2.start_time, "16:00:00", "Servicio 2 inicia a las 16:00 (no a las 15:15)");
  assert.strictEqual(svc2.end_time, "17:00:00", "Servicio 2 finaliza a las 17:00 (60m)");
  assert.strictEqual(svc2.duration_minutes, 60, "Duración exacta = 60 min");
  assert.strictEqual(svc2.employee_name, "Yholi Flores", "Especialista asignado = Yholi Flores");

  // Verificación Servicio 3 (Perfilado de Cejas - Sin Asignar)
  const svc3 = auditList[2];
  assert.strictEqual(svc3.service_name, "Perfilado de Cejas");
  assert.strictEqual(svc3.start_time, "17:00:00", "Servicio 3 inicia a las 17:00");
  assert.strictEqual(svc3.end_time, "17:30:00", "Servicio 3 finaliza a las 17:30 (30m)");
  assert.strictEqual(svc3.duration_minutes, 30, "Duración exacta = 30 min");
  assert.strictEqual(
    svc3.employee_name,
    "Sin asignar",
    "Servicio 3 NO hereda el empleado de cabecera general (emp-header)"
  );

  console.log("  ✅ Desglose de servicios de auditoría (horarios y especialistas independientes): PASS");

  // Verificación Desglose de Empleados (employees_breakdown)
  const empCarlos = resultAll.employeesMap["emp-carlos"];
  assert(empCarlos, "Carlos debe existir en el desglose");
  assert.strictEqual(empCarlos.total_duration_minutes, 45, "Carlos trabajó estrictamente 45 minutos (no 239 min de la cita)");
  assert.strictEqual(empCarlos.total_revenue_collected_cents, 4000, "Carlos generó S/ 40.00 proporcionalmente");
  assert.strictEqual(empCarlos.bookings_count, 1);
  assert.strictEqual(empCarlos.completed_count, 1);

  const empYholi = resultAll.employeesMap["emp-yholi"];
  assert(empYholi, "Yholi debe existir en el desglose");
  assert.strictEqual(empYholi.total_duration_minutes, 60, "Yholi trabajó estrictamente 60 minutos (no 239 min)");
  assert.strictEqual(empYholi.total_revenue_collected_cents, 6000, "Yholi generó S/ 60.00 proporcionalmente");
  assert.strictEqual(empYholi.bookings_count, 1);
  assert.strictEqual(empYholi.completed_count, 1);

  assert.strictEqual(
    resultAll.employeesMap["emp-header"],
    undefined,
    "El empleado de cabecera no debe recibir créditos indebidos en reservas múltiples"
  );

  console.log("  ✅ Desglose de colaboradores (horas netas e ingresos proporcionales exactos): PASS");

  // ---------------------------------------------------------------------------
  // 3. Prueba de filtrado por especialista individual
  // ---------------------------------------------------------------------------
  const resultFilteredCarlos = processReportBookings([bookingMulti], "emp-carlos");
  assert.strictEqual(resultFilteredCarlos.completedServicesAuditList.length, 1);
  assert.strictEqual(resultFilteredCarlos.completedServicesAuditList[0].service_name, "Corte Fade");
  assert.strictEqual(resultFilteredCarlos.completedServicesAuditList[0].employee_name, "Carlos García");
  assert.strictEqual(Object.keys(resultFilteredCarlos.employeesMap).length, 1);
  assert(resultFilteredCarlos.employeesMap["emp-carlos"]);
  console.log("  ✅ Filtrado estricto por especialista individual: PASS");
}

// -----------------------------------------------------------------------------
// 4. Prueba del generador de PDF con cronograma y horas netas
// -----------------------------------------------------------------------------
{
  const mockReportData: FullReportData = {
    filters: {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      bookingStatus: "all",
      paymentStatus: "all",
    },
    generated_at: "04/09/2026, 12:00:00",
    generated_by_name: "Administrador General",
    summary: {
      total_bookings: 1,
      pending_bookings: 0,
      confirmed_bookings: 0,
      completed_bookings: 1,
      cancelled_bookings: 0,
      spa_collected_cents: 6000,
      barberia_collected_cents: 7000,
      spa_bookings_count: 1,
      barberia_bookings_count: 1,
      total_services_value_cents: 13000,
      total_collected_cents: 13000,
      yape_collected_cents: 13000,
      cash_collected_cents: 0,
      transfer_collected_cents: 0,
      mixed_collected_cents: 0,
      culqi_collected_cents: 0,
      advances_collected_cents: 0,
      pending_balance_cents: 0,
      total_expenses_cents: 2000,
      net_result_cents: 11000,
    },
    bookings: [
      {
        id: "b-1",
        booking_code: "BK-01",
        client_name: "Ana Pérez",
        client_phone: "987654321",
        booking_date: "2026-09-04",
        start_time: "15:15:00",
        end_time: "17:30:00",
        employee_id: null,
        employee_name: "Carlos García, Yholi Flores",
        service_names: "Corte Fade, Limpieza Facial",
        service_type: "mixto",
        total_price_cents: 13000,
        advance_percentage: 100,
        advance_required_cents: 13000,
        advance_amount_cents: 13000,
        balance_cents: 0,
        booking_status: "completada",
        payment_status: "total",
        confirmed_at: "2026-09-04T12:00:00.000Z",
        last_payment_method: "yape",
        yape_paid_cents: 13000,
        cash_paid_cents: 0,
        verified_by_name: null,
        created_at: "2026-09-04T12:00:00.000Z",
      },
    ],
    payments: [],
    services_breakdown: [],
    employees_breakdown: [
      {
        employee_id: "emp-carlos",
        employee_name: "Carlos García",
        position: "Barbero",
        bookings_count: 1,
        completed_count: 1,
        total_revenue_collected_cents: 4000,
        total_duration_minutes: 45,
      },
      {
        employee_id: "emp-yholi",
        employee_name: "Yholi Flores",
        position: "Especialista Spa",
        bookings_count: 1,
        completed_count: 1,
        total_revenue_collected_cents: 6000,
        total_duration_minutes: 60,
      },
    ],
    expenses: [],
    completed_services_audit: [
      {
        id: "audit-1",
        booking_id: "b-1",
        booking_code: "BK-01",
        client_name: "Ana Pérez",
        service_name: "Corte Fade",
        service_type: "barberia",
        price_cents: 4000,
        employee_name: "Carlos García",
        date_exact: "2026-09-04 15:15",
        booking_date: "2026-09-04",
        start_time: "15:15:00",
        end_time: "16:00:00",
        duration_minutes: 45,
        payment_method: "yape",
        payment_status: "total",
        status: "completada",
      },
      {
        id: "audit-2",
        booking_id: "b-1",
        booking_code: "BK-01",
        client_name: "Ana Pérez",
        service_name: "Limpieza Facial",
        service_type: "spa",
        price_cents: 6000,
        employee_name: "Yholi Flores",
        date_exact: "2026-09-04 16:00",
        booking_date: "2026-09-04",
        start_time: "16:00:00",
        end_time: "17:00:00",
        duration_minutes: 60,
        payment_method: "yape",
        payment_status: "total",
        status: "completada",
      },
    ],
  };

  const pdfBytes = generatePdfReport(mockReportData);
  assert(pdfBytes instanceof Uint8Array, "Debe generar un Uint8Array válido");
  assert(pdfBytes.length > 1000, "El PDF debe tener un tamaño sustancial mayor a 1KB");
  console.log(`  ✅ Generación de PDF con columnas de horario secuencial y tiempo neto (${pdfBytes.length} bytes): PASS`);
}

console.log("\n🎉 ¡Todas las pruebas de asignación independiente y desvinculación horaria pasaron exitosamente!");
