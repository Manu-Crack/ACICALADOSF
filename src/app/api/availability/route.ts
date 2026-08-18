import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SlotStatus = "available" | "past" | "capacity_full";

export type SlotDetail = {
  slot: string;
  status: SlotStatus;
  occupied_count: number;
  max_capacity: number;
  available_capacity: number;
};

interface AtomicSlice {
  startM: number;
  endM: number;
  slotStart: string;
  slotEnd: string;
  capacity: number;
  occupied: number;
  isFull: boolean;
  freeCount: number;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * GET /api/availability
 * Consulta la disponibilidad de horarios con control de capacidad multi-trabajador:
 * 1. Condición Estricta de Estado ("Cobrar"):
 *    SOLO reservas con estado confirmado/cobrado (payment_status = 'total' o status = 'confirmada' o status = 'completada')
 *    consumen capacidad. Reservas 'pendiente' o 'sin_pago' NO restan cupos.
 * 2. Gestión de Duración (Rangos de Tiempo):
 *    Un servicio de larga duración (ej. 2 horas) abarca múltiples bloques atómicos de 30 min (ej. 10:00, 10:30, 11:00, 11:30).
 * 3. Capacidad Multi-Trabajador por Franja:
 *    Para cada bloque atómico, se cuenta cuántos colaboradores activos y no ausentes hay en el rubro (Spa o Barbería).
 *    Un horario solo se bloquea si la cantidad de reservas cobradas superpuestas en algún bloque del servicio
 *    iguala o supera la cantidad de colaboradoras activas disponibles en ese momento.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const serviceType = (searchParams.get("service_type") || "spa") as "barberia" | "spa" | "mixto";
    const serviceIdsStr = searchParams.get("service_ids");

    if (!date) {
      return NextResponse.json(
        { error: "El parámetro date (YYYY-MM-DD) es obligatorio" },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // 1. Calcular duración total acumulada de los servicios solicitados (mínimo 30 minutos)
    let totalDuration = 30;
    if (serviceIdsStr) {
      const serviceIds = serviceIdsStr.split(",").filter(Boolean);
      if (serviceIds.length > 0) {
        const { data: services } = await admin
          .from("services")
          .select("duration_minutes")
          .in("id", serviceIds);
        if (services?.length) {
          const sum = services.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
          if (sum > 0) totalDuration = sum;
        }
      }
    }

    // 2. Obtener colaboradores activos de la especialidad
    let empQuery = admin
      .from("employees")
      .select("id, first_name, last_name, type")
      .eq("is_active", true);

    if (serviceType === "barberia" || serviceType === "spa") {
      empQuery = empQuery.eq("type", serviceType);
    }

    const { data: activeEmployees } = await empQuery;
    const employeesList = activeEmployees || [];
    const empIds = employeesList.map((e) => e.id);

    // 3. Obtener ausencias y permisos (employee_blocks) para la fecha
    let absencesList: { employee_id: string; start_time: string | null; end_time: string | null }[] = [];
    if (empIds.length > 0) {
      const { data: blocks } = await admin
        .from("employee_blocks")
        .select("employee_id, start_time, end_time")
        .eq("block_date", date)
        .in("employee_id", empIds);
      if (blocks) absencesList = blocks;
    }

    // 4. Obtener reservas existentes para esa fecha y especialidad
    // Filtro absoluto: Solo se consideran ocupadas las reservas efectivamente COBRADAS o CONFIRMADAS
    let bookingsQuery = admin
      .from("bookings")
      .select("id, start_time, end_time, status, payment_status, service_type")
      .eq("booking_date", date)
      .not("status", "in", '("cancelada","expirada")');

    if (serviceType === "barberia" || serviceType === "spa") {
      bookingsQuery = bookingsQuery.in("service_type", [serviceType, "mixto"]);
    }

    const { data: allBookings, error: bookingsError } = await bookingsQuery;
    if (bookingsError) {
      console.error("[Availability] Error al consultar reservas:", bookingsError);
    }

    // Filtrar estrictamente solo aquellas reservas cobradas o confirmadas (excluir 'pendiente' y 'sin_pago')
    const paidBookings = (allBookings || []).filter((b) => {
      const isPaidOrConfirmed =
        b.payment_status === "total" ||
        b.status === "confirmada" ||
        b.status === "completada";
      const isNotCancelled = b.status !== "cancelada" && b.status !== "expirada";
      return isPaidOrConfirmed && isNotCancelled;
    });

    // 5. Horario de atención:
    // Domingo: 10:00 - 20:00 (10:00 a 20:00)
    // Lunes a Sábado: 09:00 - 21:00 (09:00 a 21:00)
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 20 : 21;
    const maxClosingMinutes = endHour * 60; // 1200 (20:00) o 1260 (21:00)
    const minOpeningMinutes = startHour * 60; // 600 (10:00) o 540 (09:00)

    // 6. Construir todas las franjas atómicas de 30 minutos del día y evaluar su ocupación individual
    const atomicSlices: AtomicSlice[] = [];

    for (let m = minOpeningMinutes; m < maxClosingMinutes; m += 30) {
      const sliceStartM = m;
      const sliceEndM = m + 30;
      const slotStart = minutesToTime(sliceStartM);
      const slotEnd = minutesToTime(sliceEndM);

      // Calcular colaboradores disponibles en este bloque atómico de 30 min (restando permisos/ausencias)
      const availableEmployeesInSlice = employeesList.filter((emp) => {
        const isAbsentInSlice = absencesList.some((b) => {
          if (b.employee_id !== emp.id) return false;
          // Ausencia de día completo
          if (!b.start_time || !b.end_time) return true;
          // Conflicto de horario parcial
          return b.start_time < slotEnd && b.end_time > slotStart;
        });
        return !isAbsentInSlice;
      });

      // Capacidad mínima garantizada de 1 colaboradora si no hay registros específicos configurados
      const sliceCapacity = Math.max(1, availableEmployeesInSlice.length);

      // Contar reservas cobradas que se superponen (overlap) en este bloque atómico de 30 min
      const sliceOccupiedCount = paidBookings.filter((b) => {
        return b.start_time < slotEnd && b.end_time > slotStart;
      }).length;

      const isFull = sliceOccupiedCount >= sliceCapacity;
      const freeCount = Math.max(0, sliceCapacity - sliceOccupiedCount);

      atomicSlices.push({
        startM: sliceStartM,
        endM: sliceEndM,
        slotStart,
        slotEnd,
        capacity: sliceCapacity,
        occupied: sliceOccupiedCount,
        isFull,
        freeCount,
      });
    }

    // 7. Zona Horaria Perú (America/Lima) para validación de horas pasadas en tiempo real
    const now = new Date();
    const peruDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
    }).format(now); // "YYYY-MM-DD"

    const peruTimeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const peruCurrentTime = peruTimeFormatter.format(now); // "HH:MM"
    const isToday = date === peruDateStr;

    // 8. Evaluar cada horario de inicio candidato considerando la duración total del servicio
    const availableSlots: string[] = [];
    const slotDetails: SlotDetail[] = [];

    for (let m = minOpeningMinutes; m < maxClosingMinutes; m += 30) {
      const candidateStartM = m;
      const candidateEndM = candidateStartM + totalDuration;
      const candidateSlotStart = minutesToTime(candidateStartM);

      // No permitir iniciar si la duración del servicio sobrepasa la hora de cierre del local
      if (candidateEndM > maxClosingMinutes) {
        continue;
      }

      // A) Validación Cronológica: Bloqueo de horas pasadas si la fecha solicitada es hoy
      if (isToday && candidateSlotStart <= peruCurrentTime) {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "past",
          occupied_count: 0,
          max_capacity: employeesList.length || 1,
          available_capacity: 0,
        });
        continue;
      }

      // B) Evaluación de todos los bloques fraccionados que abarca el servicio
      // Un servicio de 2 horas (ej. 10:00 a 12:00) abarca los bloques: 10:00-10:30, 10:30-11:00, 11:00-11:30, 11:30-12:00
      const coveredSlices = atomicSlices.filter(
        (slice) => slice.startM < candidateEndM && slice.endM > candidateStartM
      );

      // Regla de Capacidad Multi-Trabajador:
      // El horario de inicio solo se bloquea si ALGUNO de los bloques requeridos está completamente lleno
      const isAnySliceFull = coveredSlices.some((slice) => slice.isFull);
      const maxOccupiedInSlices = coveredSlices.length
        ? Math.max(...coveredSlices.map((s) => s.occupied))
        : 0;
      const minCapacityInSlices = coveredSlices.length
        ? Math.min(...coveredSlices.map((s) => s.capacity))
        : Math.max(1, employeesList.length);
      const availableCapInSlices = Math.max(0, minCapacityInSlices - maxOccupiedInSlices);

      if (isAnySliceFull) {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "capacity_full",
          occupied_count: maxOccupiedInSlices,
          max_capacity: minCapacityInSlices,
          available_capacity: 0,
        });
      } else {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "available",
          occupied_count: maxOccupiedInSlices,
          max_capacity: minCapacityInSlices,
          available_capacity: availableCapInSlices,
        });
        availableSlots.push(candidateSlotStart);
      }
    }

    const overallMaxCapacity = atomicSlices.length
      ? Math.max(...atomicSlices.map((s) => s.capacity))
      : Math.max(1, employeesList.length);

    return NextResponse.json({
      date,
      service_type: serviceType,
      total_duration_minutes: totalDuration,
      max_capacity: overallMaxCapacity,
      is_today: isToday,
      current_server_time_peru: peruCurrentTime,
      available_slots: availableSlots,
      slot_details: slotDetails,
    });
  } catch (err) {
    console.error("Availability error:", err);
    return NextResponse.json(
      { error: "Error interno al calcular disponibilidad" },
      { status: 500 }
    );
  }
}


