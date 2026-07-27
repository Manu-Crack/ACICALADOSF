import { createAdminClient } from "@/lib/supabase/admin";

export type AssignmentParams = {
  serviceIds: string[];
  serviceType: "barberia" | "spa" | "mixto";
  bookingDate: string;
  startTime: string;
  endTime: string;
};

/**
 * Algoritmo de Asignación Automática de Empleados para Reservas
 */
export async function findAvailableEmployeeForBooking(
  params: AssignmentParams
): Promise<string | null> {
  const { serviceIds, serviceType, bookingDate, startTime, endTime } = params;
  const admin = createAdminClient();

  // 1. Caso Barbería: Asignar a Yordi Atao Huaman
  if (serviceType === "barberia") {
    const { data: yordi } = await admin
      .from("employees")
      .select("id")
      .eq("type", "barberia")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (yordi) {
      // Verificar si tiene ausencia registrada para esa fecha
      const { data: absence } = await admin
        .from("employee_blocks")
        .select("id")
        .eq("employee_id", yordi.id)
        .eq("block_date", bookingDate)
        .maybeSingle();

      if (!absence) {
        return yordi.id;
      }
    }
  }

  // 2. Caso Spa o Mixto: Buscar empleados capacitados según employee_skills
  // Obtener empleados activos
  const { data: activeEmployees } = await admin
    .from("employees")
    .select("id, first_name, last_name, type, rotation_order")
    .eq("is_active", true);

  if (!activeEmployees?.length) return null;

  // Filtrar ausencias en employee_blocks para la fecha solicitada
  const { data: absences } = await admin
    .from("employee_blocks")
    .select("employee_id, start_time, end_time")
    .eq("block_date", bookingDate);

  const absentEmployeeIds = new Set(
    absences
      ?.filter((b) => {
        if (!b.start_time || !b.end_time) return true; // Bloqueo de todo el día
        return b.start_time < endTime && b.end_time > startTime; // Conflicto de horario
      })
      .map((b) => b.employee_id)
  );

  const nonAbsentEmployees = activeEmployees.filter(
    (e) => !absentEmployeeIds.has(e.id)
  );

  if (!nonAbsentEmployees.length) return null;

  // Filtrar disponibilidad por choques de horario en reservas existentes
  const { data: existingBookings } = await admin
    .from("bookings")
    .select("assigned_employee_id, start_time, end_time")
    .eq("booking_date", bookingDate)
    .in("status", ["pendiente", "confirmada"])
    .not("assigned_employee_id", "is", null);

  const busyEmployeeIds = new Set(
    existingBookings
      ?.filter((b) => b.start_time < endTime && b.end_time > startTime)
      .map((b) => b.assigned_employee_id)
  );

  const availableEmployees = nonAbsentEmployees.filter(
    (e) => !busyEmployeeIds.has(e.id)
  );

  if (!availableEmployees.length) return null;

  // Filtrar empleados por habilidades (employee_skills) para los servicios solicitados
  if (serviceIds?.length) {
    const { data: skills } = await admin
      .from("employee_skills")
      .select("employee_id, service_id")
      .in(
        "employee_id",
        availableEmployees.map((e) => e.id)
      )
      .in("service_id", serviceIds);

    if (skills?.length) {
      // Contar cuántos de los servicios solicitados domina cada empleado
      const skillCounts = new Map<string, number>();
      skills.forEach((s) => {
        skillCounts.set(s.employee_id, (skillCounts.get(s.employee_id) || 0) + 1);
      });

      // Preferir empleados capacitados para la mayor cantidad de servicios solicitados
      availableEmployees.sort((a, b) => {
        const countA = skillCounts.get(a.id) || 0;
        const countB = skillCounts.get(b.id) || 0;
        if (countA !== countB) return countB - countA;
        return (a.rotation_order || 0) - (b.rotation_order || 0);
      });

      // Retornar el empleado con mayor afinidad de habilidades
      if ((skillCounts.get(availableEmployees[0].id) || 0) > 0) {
        return availableEmployees[0].id;
      }
    }
  }

  // Fallback: Retornar el primer empleado disponible
  return availableEmployees[0].id;
}
