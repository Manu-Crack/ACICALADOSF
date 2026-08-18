import { createAdminClient } from "@/lib/supabase/admin";

export type AssignmentParams = {
  serviceIds: string[];
  serviceType: "barberia" | "spa" | "mixto";
  bookingDate: string;
  startTime: string;
  endTime: string;
};

export type AvailableEmployeeInfo = {
  id: string;
  firstName: string;
  lastName: string;
  type: string;
  rotationOrder: number;
  dailyLoad: number;
  skillMatchCount: number;
};

/**
 * Algoritmo Inteligente de Asignación Automática y Balanceo de Carga (Least Loaded + Round-Robin)
 * 1. Identifica especialidad requerida (barbería, spa o mixto).
 * 2. Filtra personal activo y no ausente (descartando permisos en employee_blocks).
 * 3. Descarta personal con colisiones de horario en la franja solicitada.
 * 4. Calcula la carga de trabajo diaria de cada colaboradora en la fecha.
 * 5. Asigna a la colaboradora capacitada con MENOR CARGA de trabajo en el día,
 *    desempatando por orden de rotación secuencial (round-robin).
 */
export async function findAvailableEmployeeForBooking(
  params: AssignmentParams
): Promise<string | null> {
  const { serviceIds, serviceType, bookingDate, startTime, endTime } = params;
  const admin = createAdminClient();

  // 1. Obtener empleados activos según especialidad
  let query = admin
    .from("employees")
    .select("id, first_name, last_name, type, rotation_order")
    .eq("is_active", true);

  if (serviceType === "barberia" || serviceType === "spa") {
    query = query.eq("type", serviceType);
  }

  const { data: activeEmployees, error: empError } = await query;
  if (empError || !activeEmployees?.length) {
    console.error("[EmployeeAssignment] No se encontraron empleados activos:", empError);
    return null;
  }

  const employeeIds = activeEmployees.map((e) => e.id);

  // 2. Filtrar ausencias y permisos (employee_blocks) para la fecha y franja horaria
  const { data: absences } = await admin
    .from("employee_blocks")
    .select("employee_id, start_time, end_time")
    .eq("block_date", bookingDate)
    .in("employee_id", employeeIds);

  const absentEmployeeIds = new Set<string>();
  if (absences?.length) {
    for (const b of absences) {
      if (!b.start_time || !b.end_time) {
        // Ausencia/permiso de todo el día
        absentEmployeeIds.add(b.employee_id);
      } else if (b.start_time < endTime && b.end_time > startTime) {
        // Conflicto de horario específico
        absentEmployeeIds.add(b.employee_id);
      }
    }
  }

  const nonAbsentEmployees = activeEmployees.filter(
    (e) => !absentEmployeeIds.has(e.id)
  );

  if (!nonAbsentEmployees.length) {
    return null;
  }

  const nonAbsentIds = nonAbsentEmployees.map((e) => e.id);

  // 3. Filtrar empleados con citas existentes superpuestas en ese bloque horario
  // Solo se consideran colisiones con reservas efectivamente COBRADAS o CONFIRMADAS
  const { data: existingBookings } = await admin
    .from("bookings")
    .select("assigned_employee_id, start_time, end_time, status, payment_status")
    .eq("booking_date", bookingDate)
    .in("assigned_employee_id", nonAbsentIds)
    .not("status", "in", '("cancelada","expirada")');

  const busyEmployeeIds = new Set<string>();
  const dailyWorkload = new Map<string, number>();

  // Inicializar contador de carga diaria en 0 para cada colaboradora no ausente
  for (const emp of nonAbsentEmployees) {
    dailyWorkload.set(emp.id, 0);
  }

  if (existingBookings?.length) {
    for (const b of existingBookings) {
      if (!b.assigned_employee_id) continue;

      const isCobradaOrConfirmada =
        b.payment_status === "total" ||
        b.status === "confirmada" ||
        b.status === "completada";

      // Solo las reservas cobradas/confirmadas generan colisión estricta de agenda
      if (isCobradaOrConfirmada) {
        // Incrementar carga de trabajo diaria de la trabajadora
        const currentCount = dailyWorkload.get(b.assigned_employee_id) || 0;
        dailyWorkload.set(b.assigned_employee_id, currentCount + 1);

        // Verificar si hay colisión horaria directa con el bloque solicitado
        if (b.start_time < endTime && b.end_time > startTime) {
          busyEmployeeIds.add(b.assigned_employee_id);
        }
      }
    }
  }

  // Empleados totalmente disponibles (sin ausencias y sin colisiones de horario)
  const availableEmployees = nonAbsentEmployees.filter(
    (e) => !busyEmployeeIds.has(e.id)
  );

  if (!availableEmployees.length) {
    return null;
  }

  // 4. Mapear habilidades (employee_skills) para los servicios solicitados
  const skillCounts = new Map<string, number>();
  if (serviceIds?.length) {
    const { data: skills } = await admin
      .from("employee_skills")
      .select("employee_id, service_id")
      .in("employee_id", availableEmployees.map((e) => e.id))
      .in("service_id", serviceIds);

    if (skills?.length) {
      for (const s of skills) {
        skillCounts.set(s.employee_id, (skillCounts.get(s.employee_id) || 0) + 1);
      }
    }
  }

  // 5. Criterio de ordenación para Distribución Equitativa (Least Loaded + Round-Robin)
  const rankedEmployees: AvailableEmployeeInfo[] = availableEmployees.map((e) => ({
    id: e.id,
    firstName: e.first_name,
    lastName: e.last_name,
    type: e.type,
    rotationOrder: e.rotation_order ?? 0,
    dailyLoad: dailyWorkload.get(e.id) ?? 0,
    skillMatchCount: skillCounts.get(e.id) ?? 0,
  }));

  rankedEmployees.sort((a, b) => {
    // 1ro: Si hay servicios con habilidades requeridas, priorizar mayor match de habilidad
    if (serviceIds?.length && a.skillMatchCount !== b.skillMatchCount) {
      return b.skillMatchCount - a.skillMatchCount;
    }
    // 2do: Balanceo de carga diario (Least Loaded: menos citas hoy = prioridad)
    if (a.dailyLoad !== b.dailyLoad) {
      return a.dailyLoad - b.dailyLoad;
    }
    // 3ro: Desempate por orden secuencial de rotación (Round-Robin)
    return a.rotationOrder - b.rotationOrder;
  });

  return rankedEmployees[0]?.id || null;
}

/**
 * Consulta la cantidad de colaboradoras activas disponibles en una fecha y especialidad
 */
export async function getActiveStaffCountBySpecialty(
  serviceType: "barberia" | "spa" | "mixto",
  bookingDate: string
): Promise<number> {
  const admin = createAdminClient();

  let query = admin
    .from("employees")
    .select("id, type")
    .eq("is_active", true);

  if (serviceType === "barberia" || serviceType === "spa") {
    query = query.eq("type", serviceType);
  }

  const { data: employees } = await query;
  if (!employees?.length) return 1;

  // Filtrar ausencias de todo el día para esa fecha
  const { data: fullDayAbsences } = await admin
    .from("employee_blocks")
    .select("employee_id")
    .eq("block_date", bookingDate)
    .is("start_time", null)
    .is("end_time", null)
    .in("employee_id", employees.map((e) => e.id));

  const absentSet = new Set(fullDayAbsences?.map((a) => a.employee_id) || []);
  const availableCount = employees.filter((e) => !absentSet.has(e.id)).length;

  return Math.max(1, availableCount);
}

