import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveStaffCountBySpecialty } from "@/lib/utils/employee-assignment";

export type SlotStatus = "available" | "past" | "capacity_full";

export type SlotDetail = {
  slot: string;
  status: SlotStatus;
  occupied_count: number;
  max_capacity: number;
};

/**
 * GET /api/availability
 * Consulta la disponibilidad de bloques horarios considerando:
 * 1. Capacidad del personal activo por especialidad (descontando ausencias).
 * 2. Regla de ocupación: SOLO reservas con pago confirmado (payment_status = 'total' o status = 'completada') restan capacidad.
 * 3. Bloqueo cronológico en tiempo real: si la fecha solicitada es hoy (en horario de Perú),
 *    todos los bloques menores o iguales a la hora actual se marcan como "past".
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

    // 1. Calcular duración total acumulada de los servicios solicitados
    let totalDuration = 30; // duración por defecto en minutos
    if (serviceIdsStr) {
      const serviceIds = serviceIdsStr.split(",").filter(Boolean);
      if (serviceIds.length > 0) {
        const { data: services } = await admin
          .from("services")
          .select("duration_minutes")
          .in("id", serviceIds);
        if (services?.length) {
          totalDuration = services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        }
      }
    }

    // 2. Calcular la capacidad máxima del personal activo en la fecha y especialidad
    const maxCapacity = await getActiveStaffCountBySpecialty(serviceType, date);

    // 3. Obtener reservas existentes para esa fecha y especialidad
    // Regla de Ocupación: Solo se consideran ocupadas las reservas COBRADAS (payment_status = 'total' o status = 'completada')
    let bookingsQuery = admin
      .from("bookings")
      .select("id, start_time, end_time, status, payment_status, service_type")
      .eq("booking_date", date)
      .not("status", "in", '("cancelada","expirada")');

    if (serviceType === "barberia" || serviceType === "spa") {
      bookingsQuery = bookingsQuery.eq("service_type", serviceType);
    }

    const { data: allBookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) {
      console.error("[Availability] Error al consultar reservas:", bookingsError);
    }

    // Filtrar únicamente aquellas que están efectivamente cobradas
    const paidBookings = (allBookings || []).filter(
      (b) => b.payment_status === "total" || b.status === "completada"
    );

    // 4. Determinar fecha y hora actual en la zona horaria del negocio (Perú UTC-5: America/Lima)
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

    // 5. Horario de atención:
    // Domingo: 10:00 - 20:00
    // Lunes a Sábado: 09:00 - 21:00
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    const isSunday = dateObj.getDay() === 0;

    const startHour = isSunday ? 10 : 9;
    const endHour = isSunday ? 20 : 21;
    const maxClosingMinutes = endHour * 60;

    const availableSlots: string[] = [];
    const slotDetails: SlotDetail[] = [];

    for (let hour = startHour; hour <= endHour; hour++) {
      for (const min of [0, 30]) {
        // A la hora de cierre exacta en punto (:00) no se abre bloque de :30
        if (hour === endHour && min > 0) continue;

        const slotStart = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const startMinutes = hour * 60 + min;
        const endMinutes = startMinutes + totalDuration;

        // No permitir citas cuya duración exceda el cierre del local
        if (endMinutes > maxClosingMinutes + 30) continue;

        const endHourVal = Math.floor(endMinutes / 60);
        const endMinVal = endMinutes % 60;
        const slotEnd = `${String(endHourVal).padStart(2, "0")}:${String(endMinVal).padStart(2, "0")}`;

        // A) Validación Cronológica: Bloqueo de horas pasadas si la fecha es hoy
        if (isToday && slotStart <= peruCurrentTime) {
          slotDetails.push({
            slot: slotStart,
            status: "past",
            occupied_count: 0,
            max_capacity: maxCapacity,
          });
          continue;
        }

        // B) Validación de Capacidad: Contar reservas cobradas concurrentes en esta franja
        const occupiedCount = paidBookings.filter(
          (b) => b.start_time < slotEnd && b.end_time > slotStart
        ).length;

        if (occupiedCount >= maxCapacity) {
          slotDetails.push({
            slot: slotStart,
            status: "capacity_full",
            occupied_count: occupiedCount,
            max_capacity: maxCapacity,
          });
        } else {
          slotDetails.push({
            slot: slotStart,
            status: "available",
            occupied_count: occupiedCount,
            max_capacity: maxCapacity,
          });
          availableSlots.push(slotStart);
        }
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
    return NextResponse.json({ error: "Error interno al calcular disponibilidad" }, { status: 500 });
  }
}

