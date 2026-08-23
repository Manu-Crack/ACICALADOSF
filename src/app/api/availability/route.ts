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

function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hasTimeOverlap(
  startA: string | null | undefined,
  endA: string | null | undefined,
  startB: string | null | undefined,
  endB: string | null | undefined
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && eA > sB;
}

/**
 * GET /api/availability
 * Consulta la disponibilidad de horarios con control estricto de agenda individual y capacidad multi-trabajador:
 * 1. Cruce de Agendas Individuales:
 *    Toda reserva activa (status NOT IN ('cancelada', 'expirada')) asignada a un colaborador ocupa su agenda.
 * 2. Disponibilidad Continua por Duración:
 *    Un colaborador se considera disponible para una cita si y solo si está libre (sin ausencias ni reservas superpuestas)
 *    durante toda la duración requerida por los servicios solicitados ([hora_inicio, hora_fin]).
 * 3. Capacidad Real:
 *    La capacidad disponible en cada horario es el número exacto de colaboradores libres para atender esa duración.
 *    Si ningún colaborador está libre durante esa franja, el horario se marca como "capacity_full" (Agotado).
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

    // 2. Obtener colaboradores activos de la especialidad solicitada
    let empQuery = admin
      .from("employees")
      .select("id, first_name, last_name, type")
      .eq("is_active", true)
      .neq("type", "recepcionista");

    if (serviceType === "barberia" || serviceType === "spa") {
      empQuery = empQuery.eq("type", serviceType);
    }

    const { data: activeEmployees } = await empQuery;
    const employeesList = activeEmployees || [];
    const empIds = employeesList.map((e) => e.id);

    // 3. Obtener ausencias y permisos aprobados (employee_blocks) para la fecha
    let absencesList: { employee_id: string; start_time: string | null; end_time: string | null; is_all_day?: boolean }[] = [];
    if (empIds.length > 0) {
      const { data: blocks } = await admin
        .from("employee_blocks")
        .select("employee_id, start_time, end_time, is_all_day")
        .lte("start_date", date)
        .gte("end_date", date)
        .eq("status", "approved")
        .in("employee_id", empIds);
      if (blocks) absencesList = blocks;
    }

    // 4. Obtener todas las reservas activas (no canceladas ni expiradas) para esa fecha
    const { data: activeBookings, error: bookingsError } = await admin
      .from("bookings")
      .select("id, assigned_employee_id, start_time, end_time, status, service_type")
      .eq("booking_date", date)
      .not("status", "in", '("cancelada","expirada")');

    if (bookingsError) {
      console.error("[Availability] Error al consultar reservas:", bookingsError);
    }

    const bookingsList = activeBookings || [];

    // 5. Horario de atención:
    // Domingo: 10:00 - 20:00 (600 a 1200 min)
    // Lunes a Sábado: 09:00 - 21:00 (540 a 1260 min)
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 20 : 21;
    const maxClosingMinutes = endHour * 60;
    const minOpeningMinutes = startHour * 60;

    // 6. Zona Horaria Perú (America/Lima) para validación en tiempo real
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

    // 7. Evaluar cada horario candidato con validación de agenda individual
    const availableSlots: string[] = [];
    const slotDetails: SlotDetail[] = [];
    const maxCapacity = Math.max(1, employeesList.length);

    for (let m = minOpeningMinutes; m < maxClosingMinutes; m += 30) {
      const candidateStartM = m;
      const candidateEndM = candidateStartM + totalDuration;
      const candidateSlotStart = minutesToTime(candidateStartM);
      const candidateSlotEnd = minutesToTime(candidateEndM);

      // No permitir iniciar si el servicio excede la hora de cierre
      if (candidateEndM > maxClosingMinutes) {
        continue;
      }

      // A) Bloqueo de horas pasadas para la fecha de hoy
      if (isToday && candidateSlotStart <= peruCurrentTime) {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "past",
          occupied_count: 0,
          max_capacity: maxCapacity,
          available_capacity: 0,
        });
        continue;
      }

      // B) Cruce individual: Verificar qué colaboradores específicos están libres durante toda la franja [candidateSlotStart, candidateSlotEnd]
      const freeEmployees = employeesList.filter((emp) => {
        // 1. Verificar si el colaborador tiene permisos / ausencias superpuestas
        const hasAbsence = absencesList.some((b) => {
          if (b.employee_id !== emp.id) return false;
          // Ausencia de día completo
          if (!b.start_time || !b.end_time) return true;
          // Solapamiento de horario
          return hasTimeOverlap(b.start_time, b.end_time, candidateSlotStart, candidateSlotEnd);
        });

        if (hasAbsence) return false;

        // 2. Verificar si el colaborador tiene alguna cita activa asignada superpuesta
        const hasBookingConflict = bookingsList.some((b) => {
          if (b.assigned_employee_id !== emp.id) return false;
          // Solapamiento de horario con otra reserva
          return hasTimeOverlap(b.start_time, b.end_time, candidateSlotStart, candidateSlotEnd);
        });

        return !hasBookingConflict;
      });

      // Contabilizar reservas activas sin asignar que colisionan en ese horario (para no sobrecargar)
      const unassignedOverlappingCount = bookingsList.filter((b) => {
        if (b.assigned_employee_id) return false;
        return hasTimeOverlap(b.start_time, b.end_time, candidateSlotStart, candidateSlotEnd);
      }).length;

      const availableCapacity = Math.max(
        0,
        freeEmployees.length - unassignedOverlappingCount
      );
      const occupiedCount = Math.max(0, maxCapacity - availableCapacity);

      if (availableCapacity > 0) {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "available",
          occupied_count: occupiedCount,
          max_capacity: maxCapacity,
          available_capacity: availableCapacity,
        });
        availableSlots.push(candidateSlotStart);
      } else {
        slotDetails.push({
          slot: candidateSlotStart,
          status: "capacity_full",
          occupied_count: maxCapacity,
          max_capacity: maxCapacity,
          available_capacity: 0,
        });
      }
    }

    return NextResponse.json({
      date,
      service_type: serviceType,
      total_duration_minutes: totalDuration,
      max_capacity: maxCapacity,
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


