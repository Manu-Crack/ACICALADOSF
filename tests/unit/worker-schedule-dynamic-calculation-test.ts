import assert from "node:assert";

// Copia exacta de las utilidades implementadas en EmployeesManager
function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TestService {
  id: string;
  name: string;
  duration_minutes: number;
  service_price_cents: number;
  assigned_employee_id: string | null;
  created_at: string;
}

interface TestBooking {
  id: string;
  booking_code: string;
  start_time: string;
  end_time: string;
  assigned_employee_id: string | null;
  booking_services: TestService[];
}

function computeWorkerCards(b: TestBooking) {
  const services = b.booking_services || [];
  const sortedServices = [...services].sort((a, bItem) => {
    if (a.created_at && bItem.created_at) {
      const diff = new Date(a.created_at).getTime() - new Date(bItem.created_at).getTime();
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const baseStartMin = parseTimeToMinutes(b.start_time);
  let currentMin = baseStartMin;

  const scheduledServices: Array<{
    service: TestService & { start_time: string; end_time: string };
    workerId: string | null;
    startMin: number;
    endMin: number;
    startTimeStr: string;
    endTimeStr: string;
  }> = [];

  for (const svc of sortedServices) {
    const duration = Math.max(1, Number(svc.duration_minutes) || 30);
    const svcStartMin = currentMin;
    const svcEndMin = svcStartMin + duration;
    const startTimeStr = formatMinutesToTime(svcStartMin);
    const endTimeStr = formatMinutesToTime(svcEndMin);
    const wId = svc.assigned_employee_id;

    scheduledServices.push({
      service: {
        ...svc,
        start_time: startTimeStr,
        end_time: endTimeStr,
      },
      workerId: wId,
      startMin: svcStartMin,
      endMin: svcEndMin,
      startTimeStr,
      endTimeStr,
    });

    currentMin = svcEndMin;
  }

  const groups = new Map<string | null, typeof scheduledServices>();
  for (const scheduled of scheduledServices) {
    const currentList = groups.get(scheduled.workerId) || [];
    currentList.push(scheduled);
    groups.set(scheduled.workerId, currentList);
  }

  const cards: Array<{
    workerId: string | null;
    startTime: string;
    endTime: string;
    totalDurationMinutes: number;
    services: Array<TestService & { start_time: string; end_time: string }>;
  }> = [];

  for (const [wId, workerScheduled] of groups.entries()) {
    const svcs = workerScheduled.map((s) => s.service);
    const duration = svcs.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0) || 30;
    const firstService = workerScheduled[0];
    const lastService = workerScheduled[workerScheduled.length - 1];

    const workerStartTime = firstService?.startTimeStr || formatMinutesToTime(baseStartMin);
    const workerEndTime = lastService?.endTimeStr || formatMinutesToTime(baseStartMin + duration);

    cards.push({
      workerId: wId,
      startTime: workerStartTime,
      endTime: workerEndTime,
      totalDurationMinutes: duration,
      services: svcs,
    });
  }

  return cards;
}

console.log("🧪 Iniciando pruebas de cálculo dinámico de cronogramas por trabajador...");

// Caso 1: Cita real 'f2ef9e03' (Tinte 120m con Janet + Manicure 59m con Malu)
{
  const b: TestBooking = {
    id: "booking-1",
    booking_code: "f2ef9e03",
    start_time: "17:00:00",
    end_time: "19:59:00",
    assigned_employee_id: "emp-janet",
    booking_services: [
      {
        id: "s1",
        name: "TINTE COLOR ENTERO",
        duration_minutes: 120,
        service_price_cents: 8000,
        assigned_employee_id: "emp-janet",
        created_at: "2026-09-02T22:02:24.207Z",
      },
      {
        id: "s2",
        name: "MANICURE",
        duration_minutes: 59,
        service_price_cents: 3000,
        assigned_employee_id: "emp-malu",
        created_at: "2026-09-02T22:02:24.208Z",
      },
    ],
  };

  const cards = computeWorkerCards(b);
  assert.strictEqual(cards.length, 2, "Deben generarse 2 tarjetas separadas");

  const janetCard = cards.find((c) => c.workerId === "emp-janet")!;
  assert.strictEqual(janetCard.startTime, "17:00", "Janet inicia a las 17:00");
  assert.strictEqual(janetCard.endTime, "19:00", "Janet finaliza a las 19:00");
  assert.strictEqual(janetCard.totalDurationMinutes, 120, "Duración de Janet = 120 min");

  const maluCard = cards.find((c) => c.workerId === "emp-malu")!;
  assert.strictEqual(maluCard.startTime, "19:00", "Malu inicia a las 19:00 (no arrastra 17:00)");
  assert.strictEqual(maluCard.endTime, "19:59", "Malu finaliza a las 19:59");
  assert.strictEqual(maluCard.totalDurationMinutes, 59, "Duración de Malu = 59 min");

  console.log("  ✅ Caso 1 (f2ef9e03): Janet 17:00-19:00 (120m) & Malu 19:00-19:59 (59m) PASS");
}

// Caso 2: Cita real '8ee0e3b3' (Rizado 45m con Yholi + Corte Fade 60m con Aaron)
{
  const b: TestBooking = {
    id: "booking-2",
    booking_code: "8ee0e3b3",
    start_time: "14:15:00",
    end_time: "16:00:00",
    assigned_employee_id: "emp-yholi",
    booking_services: [
      {
        id: "s1",
        name: "RIZADO DE PESTAÑAS",
        duration_minutes: 45,
        service_price_cents: 5000,
        assigned_employee_id: "emp-yholi",
        created_at: "2026-09-01T21:08:32.128Z",
      },
      {
        id: "s2",
        name: "CORTE FADE",
        duration_minutes: 60,
        service_price_cents: 3500,
        assigned_employee_id: "emp-aaron",
        created_at: "2026-09-01T21:08:32.129Z",
      },
    ],
  };

  const cards = computeWorkerCards(b);
  assert.strictEqual(cards.length, 2);

  const yholiCard = cards.find((c) => c.workerId === "emp-yholi")!;
  assert.strictEqual(yholiCard.startTime, "14:15");
  assert.strictEqual(yholiCard.endTime, "15:00");
  assert.strictEqual(yholiCard.totalDurationMinutes, 45);

  const aaronCard = cards.find((c) => c.workerId === "emp-aaron")!;
  assert.strictEqual(aaronCard.startTime, "15:00", "Aaron inicia a las 15:00 (no a las 14:15)");
  assert.strictEqual(aaronCard.endTime, "16:00", "Aaron finaliza a las 16:00");
  assert.strictEqual(aaronCard.totalDurationMinutes, 60);

  console.log("  ✅ Caso 2 (8ee0e3b3): Yholi 14:15-15:00 (45m) & Aaron 15:00-16:00 (60m) PASS");
}

// Caso 3: Servicios alternados (A -> B -> A)
{
  const b: TestBooking = {
    id: "booking-3",
    booking_code: "interleaved-1",
    start_time: "10:00:00",
    end_time: "11:45:00",
    assigned_employee_id: "emp-A",
    booking_services: [
      {
        id: "s1",
        name: "Servicio A1",
        duration_minutes: 30,
        service_price_cents: 2000,
        assigned_employee_id: "emp-A",
        created_at: "2026-09-01T10:00:00.000Z",
      },
      {
        id: "s2",
        name: "Servicio B1",
        duration_minutes: 45,
        service_price_cents: 3000,
        assigned_employee_id: "emp-B",
        created_at: "2026-09-01T10:00:01.000Z",
      },
      {
        id: "s3",
        name: "Servicio A2",
        duration_minutes: 30,
        service_price_cents: 2500,
        assigned_employee_id: "emp-A",
        created_at: "2026-09-01T10:00:02.000Z",
      },
    ],
  };

  const cards = computeWorkerCards(b);
  const cardA = cards.find((c) => c.workerId === "emp-A")!;
  const cardB = cards.find((c) => c.workerId === "emp-B")!;

  assert.strictEqual(cardA.startTime, "10:00");
  assert.strictEqual(cardA.endTime, "11:45");
  assert.strictEqual(cardA.totalDurationMinutes, 60);

  assert.strictEqual(cardB.startTime, "10:30");
  assert.strictEqual(cardB.endTime, "11:15");
  assert.strictEqual(cardB.totalDurationMinutes, 45);

  console.log("  ✅ Caso 3 (Intercalado): A (10:00-11:45, 60m dedicados) & B (10:30-11:15, 45m) PASS");
}

console.log("\n🎉 ¡Todos los tests pasaron exitosamente!");
