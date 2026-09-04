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

function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
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
    .eq("is_active", true)
    .neq("type", "recepcionista");

  if (serviceType === "barberia" || serviceType === "spa") {
    query = query.eq("type", serviceType);
  }

  const { data: activeEmployees, error: empError } = await query;
  if (empError || !activeEmployees?.length) {
    console.error("[EmployeeAssignment] No se encontraron empleados activos:", empError);
    return null;
  }

  const employeeIds = activeEmployees.map((e) => e.id);

  // 2. Filtrar ausencias y permisos aprobados (employee_blocks) que cubran la fecha y franja horaria
  const { data: absences } = await admin
    .from("employee_blocks")
    .select("employee_id, start_date, end_date, is_all_day, start_time, end_time, status")
    .lte("start_date", bookingDate)
    .gte("end_date", bookingDate)
    .eq("status", "approved")
    .in("employee_id", employeeIds);

  const absentEmployeeIds = new Set<string>();
  if (absences?.length) {
    for (const b of absences) {
      if (b.is_all_day || !b.start_time || !b.end_time) {
        // Ausencia/permiso de todo el día
        absentEmployeeIds.add(b.employee_id);
      } else if (hasTimeOverlap(b.start_time, b.end_time, startTime, endTime)) {
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
  // Toda reserva activa (estado distinto de 'cancelada' y 'expirada') ocupa la agenda del colaborador
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

      // Incrementar carga de trabajo diaria de la trabajadora por cada cita activa en el día
      const currentCount = dailyWorkload.get(b.assigned_employee_id) || 0;
      dailyWorkload.set(b.assigned_employee_id, currentCount + 1);

      // Verificar si hay colisión horaria directa (solapamiento) con el bloque solicitado
      if (hasTimeOverlap(b.start_time, b.end_time, startTime, endTime)) {
        busyEmployeeIds.add(b.assigned_employee_id);
      }
    }
  }

  // Empleados totalmente disponibles (sin ausencias y sin colisiones de horario en la franja)
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

export interface ServiceInputItem {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  type: "barberia" | "spa";
}

export interface AssignedServiceItem {
  service_id: string;
  service_name: string;
  service_price_cents: number;
  duration_minutes: number;
  service_type: "barberia" | "spa";
  start_time: string; // "HH:MM:SS"
  end_time: string;   // "HH:MM:SS"
  assigned_employee_id: string | null;
  employee_name?: string;
  employee_type?: string;
}

export interface MultiServiceAssignmentResult {
  items: AssignedServiceItem[];
  primary_employee_id: string | null;
  total_duration_minutes: number;
  formatted_start_time: string;
  formatted_end_time: string;
  has_conflicts: boolean;
  conflict_messages: string[];
}

/**
 * Asigna de forma inteligente y equitativa colaboradores disponibles a cada servicio
 * de una reserva simple o multi-servicio, evitando solapamientos y verificando ausencias.
 */
export async function assignMultiServiceEmployees(params: {
  services: ServiceInputItem[];
  bookingDate: string;
  startTime: string; // "HH:MM" o "HH:MM:SS"
  manualAssignments?: Record<string, string> | null; // { [service_id]: employee_id }
  globalEmployeeId?: string | null; // Empleado asignado para toda la cita
}): Promise<MultiServiceAssignmentResult> {
  const { services, bookingDate, startTime, manualAssignments, globalEmployeeId } = params;
  const admin = createAdminClient();

  // 1. Obtener empleados activos
  const { data: allEmployees } = await admin
    .from("employees")
    .select("id, first_name, last_name, type, rotation_order")
    .eq("is_active", true)
    .neq("type", "recepcionista");

  const activeEmployees = allEmployees || [];
  const employeeMap = new Map(activeEmployees.map((e) => [e.id, e]));

  // 2. Obtener ausencias y permisos aprobados en la fecha
  const { data: absences } = await admin
    .from("employee_blocks")
    .select("employee_id, start_date, end_date, is_all_day, start_time, end_time, status")
    .lte("start_date", bookingDate)
    .gte("end_date", bookingDate)
    .eq("status", "approved");

  // 3. Obtener asistencias con falta en la fecha
  const { data: attendances } = await admin
    .from("employee_attendances")
    .select("employee_id, status")
    .eq("date", bookingDate)
    .in("status", ["falta_injustificada", "falta_justificada"]);

  const absentTodayIds = new Set<string>();
  (attendances || []).forEach((att) => absentTodayIds.add(att.employee_id));

  // 4. Obtener reservas activas en la fecha
  const { data: existingBookings } = await admin
    .from("bookings")
    .select("id, booking_code, assigned_employee_id, start_time, end_time, status")
    .eq("booking_date", bookingDate)
    .not("status", "in", '("cancelada","expirada")');

  // Obtener también los booking_services asignados para detectar solapamientos por servicio
  const { data: existingBookingServices } = await admin
    .from("booking_services")
    .select("booking_id, assigned_employee_id, duration_minutes, bookings!inner(booking_date, start_time, end_time, status)")
    .eq("bookings.booking_date", bookingDate)
    .not("bookings.status", "in", '("cancelada","expirada")');

  // Mapear franjas ocupadas en memoria por empleado
  const employeeBusySlots = new Map<string, Array<{ start: string; end: string }>>();
  const dailyWorkload = new Map<string, number>();

  for (const emp of activeEmployees) {
    employeeBusySlots.set(emp.id, []);
    dailyWorkload.set(emp.id, 0);
  }

  // Cargar reservas existentes en los busy slots
  for (const b of existingBookings || []) {
    if (b.assigned_employee_id && b.start_time && b.end_time) {
      const slots = employeeBusySlots.get(b.assigned_employee_id) || [];
      slots.push({ start: b.start_time, end: b.end_time });
      employeeBusySlots.set(b.assigned_employee_id, slots);

      const count = dailyWorkload.get(b.assigned_employee_id) || 0;
      dailyWorkload.set(b.assigned_employee_id, count + 1);
    }
  }

  // Cargar sub-servicios con asignación directa si existen
  for (const bs of existingBookingServices || []) {
    if (bs.assigned_employee_id) {
      const bookingData: any = bs.bookings;
      if (bookingData?.start_time && bookingData?.end_time) {
        const slots = employeeBusySlots.get(bs.assigned_employee_id) || [];
        slots.push({ start: bookingData.start_time, end: bookingData.end_time });
        employeeBusySlots.set(bs.assigned_employee_id, slots);
      }
    }
  }

  // 5. Asignar servicios en la cita respetando paralelismo entre especialistas distintos
  const timeParts = startTime.split(":");
  const baseStartH = parseInt(timeParts[0], 10) || 0;
  const baseStartM = parseInt(timeParts[1], 10) || 0;
  const baseStartMinutes = baseStartH * 60 + baseStartM;

  const assignedItems: AssignedServiceItem[] = [];
  const conflictMessages: string[] = [];
  const workerLastEndMinutes = new Map<string, number>();

  const formattedBookingStartTime = `${String(baseStartH).padStart(2, "0")}:${String(baseStartM).padStart(2, "0")}:00`;

  const getSlotForWorker = (wId: string | null, duration: number) => {
    const sMin = wId ? (workerLastEndMinutes.get(wId) ?? baseStartMinutes) : baseStartMinutes;
    const eMin = sMin + duration;
    const sH = Math.floor(sMin / 60);
    const sM = sMin % 60;
    const eH = Math.floor(eMin / 60);
    const eM = eMin % 60;
    return {
      startMin: sMin,
      endMin: eMin,
      startFormatted: `${String(sH).padStart(2, "0")}:${String(sM).padStart(2, "0")}:00`,
      endFormatted: `${String(eH).padStart(2, "0")}:${String(eM).padStart(2, "0")}:00`,
    };
  };

  for (const svc of services) {
    const duration = svc.duration_minutes || 30;

    const isEmpFree = (empId: string, slotStartFormatted: string, slotEndFormatted: string) => {
      // Verificar si tiene falta registrada
      if (absentTodayIds.has(empId)) return false;

      // Verificar ausencias / permisos en employee_blocks
      const empAbsences = (absences || []).filter((b) => b.employee_id === empId);
      for (const b of empAbsences) {
        if (b.is_all_day || !b.start_time || !b.end_time) return false;
        if (hasTimeOverlap(b.start_time, b.end_time, slotStartFormatted, slotEndFormatted)) return false;
      }

      // Verificar franjas ocupadas
      const busySlots = employeeBusySlots.get(empId) || [];
      for (const slot of busySlots) {
        if (hasTimeOverlap(slot.start, slot.end, slotStartFormatted, slotEndFormatted)) return false;
      }

      return true;
    };

    // Comprobar si hay una asignación manual para este servicio o global
    const requestedEmpId = manualAssignments?.[svc.id] || globalEmployeeId || null;
    let chosenEmpId: string | null = null;
    let chosenEmpName = "Sin Asignar";
    let chosenEmpType = svc.type;
    let finalSlot = getSlotForWorker(requestedEmpId, duration);

    if (requestedEmpId) {
      const manualEmp = employeeMap.get(requestedEmpId);
      const manualSlot = getSlotForWorker(requestedEmpId, duration);
      if (manualEmp && isEmpFree(requestedEmpId, manualSlot.startFormatted, manualSlot.endFormatted)) {
        chosenEmpId = requestedEmpId;
        chosenEmpName = `${manualEmp.first_name} ${manualEmp.last_name}`.trim();
        chosenEmpType = manualEmp.type;
        finalSlot = manualSlot;
      } else {
        const empLabel = manualEmp ? `${manualEmp.first_name} ${manualEmp.last_name}` : "Colaborador";
        conflictMessages.push(
          `${empLabel} no se encuentra disponible para el servicio "${svc.name}" (${manualSlot.startFormatted.slice(0, 5)} - ${manualSlot.endFormatted.slice(0, 5)}) por cruce de horario o ausencia.`
        );
      }
    }

    // Si no hubo asignación manual o no estaba disponible, asignar automáticamente
    if (!chosenEmpId) {
      // Filtrar candidatos por especialidad y disponibilidad en su respectivo horario
      const candidates = activeEmployees.filter((e) => {
        if (svc.type === "barberia" && e.type !== "barberia" && e.type !== "ambos") return false;
        if (svc.type === "spa" && e.type !== "spa" && e.type !== "ambos") return false;
        const candidateSlot = getSlotForWorker(e.id, duration);
        return isEmpFree(e.id, candidateSlot.startFormatted, candidateSlot.endFormatted);
      });

      if (candidates.length > 0) {
        // Ordenar por menor carga diaria y desempatar por rotación
        candidates.sort((a, b) => {
          const loadA = dailyWorkload.get(a.id) || 0;
          const loadB = dailyWorkload.get(b.id) || 0;
          if (loadA !== loadB) return loadA - loadB;
          return (a.rotation_order ?? 0) - (b.rotation_order ?? 0);
        });

        const best = candidates[0];
        chosenEmpId = best.id;
        chosenEmpName = `${best.first_name} ${best.last_name}`.trim();
        chosenEmpType = best.type;
        finalSlot = getSlotForWorker(best.id, duration);
      } else {
        finalSlot = getSlotForWorker(null, duration);
      }
    }

    // Si se asignó un empleado, registrar su franja ocupada e incrementar su carga diaria y cronograma
    if (chosenEmpId) {
      const slots = employeeBusySlots.get(chosenEmpId) || [];
      slots.push({ start: finalSlot.startFormatted, end: finalSlot.endFormatted });
      employeeBusySlots.set(chosenEmpId, slots);

      const currentLoad = dailyWorkload.get(chosenEmpId) || 0;
      dailyWorkload.set(chosenEmpId, currentLoad + 1);
      workerLastEndMinutes.set(chosenEmpId, finalSlot.endMin);
    }

    assignedItems.push({
      service_id: svc.id,
      service_name: svc.name,
      service_price_cents: svc.price_cents,
      duration_minutes: duration,
      service_type: svc.type,
      start_time: finalSlot.startFormatted,
      end_time: finalSlot.endFormatted,
      assigned_employee_id: chosenEmpId,
      employee_name: chosenEmpName,
      employee_type: chosenEmpType,
    });
  }

  const primaryEmployeeId =
    assignedItems.find((i) => i.assigned_employee_id)?.assigned_employee_id || globalEmployeeId || null;

  const maxEndMinutes = Math.max(
    ...assignedItems.map((i) => timeToMinutes(i.end_time)),
    baseStartMinutes + 30
  );
  const totalBookingDuration = Math.max(1, maxEndMinutes - baseStartMinutes);
  const endH = Math.floor(maxEndMinutes / 60);
  const endM = maxEndMinutes % 60;
  const formattedBookingEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

  return {
    items: assignedItems,
    primary_employee_id: primaryEmployeeId,
    total_duration_minutes: totalBookingDuration,
    formatted_start_time: formattedBookingStartTime,
    formatted_end_time: formattedBookingEndTime,
    has_conflicts: conflictMessages.length > 0,
    conflict_messages: conflictMessages,
  };
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
    .eq("is_active", true)
    .neq("type", "recepcionista");

  if (serviceType === "barberia" || serviceType === "spa") {
    query = query.eq("type", serviceType);
  }

  const { data: employees } = await query;
  if (!employees?.length) return 1;

  // Filtrar ausencias aprobadas de todo el día para esa fecha
  const { data: fullDayAbsences } = await admin
    .from("employee_blocks")
    .select("employee_id")
    .lte("start_date", bookingDate)
    .gte("end_date", bookingDate)
    .eq("status", "approved")
    .or("is_all_day.eq.true,start_time.is.null")
    .in("employee_id", employees.map((e) => e.id));

  const absentSet = new Set(fullDayAbsences?.map((a) => a.employee_id) || []);
  const availableCount = employees.filter((e) => !absentSet.has(e.id)).length;

  return Math.max(1, availableCount);
}

