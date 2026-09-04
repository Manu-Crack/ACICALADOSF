/**
 * Utilidades para cálculo genérico y programación de cronogramas en citas
 * (Paralelo vs. Secuencial)
 * Sistema: Acicalados Spa & Barber Shop
 */

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number, includeSeconds = true): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const base = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return includeSeconds ? `${base}:00` : base;
}

export interface ServiceScheduleInput {
  id?: string;
  service_id?: string;
  duration_minutes?: number | null;
  assigned_employee_id?: string | null;
  created_at?: string | null;
}

export interface ScheduledServiceOutput<T = any> {
  item: T;
  startMin: number;
  endMin: number;
  startTimeStr: string; // "HH:MM:00"
  endTimeStr: string;   // "HH:MM:00"
  hora_inicio?: string; // "HH:MM:00"
  hora_fin?: string;    // "HH:MM:00"
  durationMinutes: number;
  workerId: string | null;
}

export interface ParallelScheduleResult<T = any> {
  scheduledServices: ScheduledServiceOutput<T>[];
  baseStartMin: number;
  maxEndMin: number;
  totalDurationMinutes: number;
  startTimeStr: string;
  endTimeStr: string;
}

/**
 * Calcula el cronograma dinámico de servicios respetando:
 * 1. Regla de Paralelismo (Colaboradores Distintos): Si dos servicios están asignados
 *    a especialistas distintos, arrancan simultáneamente a la hora base de la cita.
 * 2. Regla Secuencial (Mismo Colaborador): Si un especialista tiene dos o más servicios
 *    a su cargo dentro de la cita, se encadenan uno tras otro para él.
 * 3. Servicios sin asignar: Arrancan a la hora base en su propio slot paralelo.
 * 4. Cita Padre: Su hora de fin es la hora máxima de finalización entre todos los servicios,
 *    y su duración total es maxEndMin - baseStartMin.
 */
export function calculateParallelServiceSchedule<T extends ServiceScheduleInput>(
  bookingStartTime: string,
  services: T[],
  defaultEmployeeId?: string | null
): ParallelScheduleResult<T> {
  const baseStartMin = parseTimeToMinutes(bookingStartTime);

  if (!services || services.length === 0) {
    return {
      scheduledServices: [],
      baseStartMin,
      maxEndMin: baseStartMin + 30,
      totalDurationMinutes: 30,
      startTimeStr: formatMinutesToTime(baseStartMin),
      endTimeStr: formatMinutesToTime(baseStartMin + 30),
    };
  }

  // Ordenar respetando cronología de creación / secuencia contratada
  const sorted = [...services].sort((a, b) => {
    if (a.created_at && b.created_at) {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (diff !== 0) return diff;
    }
    return 0;
  });

  const isMultiService = sorted.length >= 2;
  const workerLastEndMinutes = new Map<string, number>();

  const scheduledServices: ScheduledServiceOutput<T>[] = sorted.map((svc, idx) => {
    const duration = Math.max(1, Number(svc.duration_minutes) || 30);

    // Asignación de especialista:
    // En citas múltiples (>=2), no hereda el empleado general de cabecera.
    // En citas simples (1 servicio), puede heredar defaultEmployeeId.
    const workerId = isMultiService
      ? (svc.assigned_employee_id || null)
      : (svc.assigned_employee_id || defaultEmployeeId || null);

    // Clave para la línea de tiempo: Si está asignado, usamos el ID del trabajador.
    // Si no está asignado, cada servicio no asignado corre en su propio hilo paralelo (inicia al inicio de la cita).
    const workerKey = workerId || `unassigned_${svc.id || svc.service_id || idx}`;

    const svcStartMin = workerLastEndMinutes.get(workerKey) ?? baseStartMin;
    const svcEndMin = svcStartMin + duration;
    workerLastEndMinutes.set(workerKey, svcEndMin);

    return {
      item: svc,
      startMin: svcStartMin,
      endMin: svcEndMin,
      startTimeStr: formatMinutesToTime(svcStartMin),
      endTimeStr: formatMinutesToTime(svcEndMin),
      hora_inicio: formatMinutesToTime(svcStartMin),
      hora_fin: formatMinutesToTime(svcEndMin),
      durationMinutes: duration,
      workerId,
    };
  });

  const maxEndMin = Math.max(...scheduledServices.map((s) => s.endMin), baseStartMin + 30);
  const totalDurationMinutes = Math.max(1, maxEndMin - baseStartMin);

  return {
    scheduledServices,
    baseStartMin,
    maxEndMin,
    totalDurationMinutes,
    startTimeStr: formatMinutesToTime(baseStartMin),
    endTimeStr: formatMinutesToTime(maxEndMin),
  };
}
