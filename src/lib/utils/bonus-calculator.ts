import { DEFAULT_BONUS_RULES, type BonusRule, type BonusCalculationResult } from "@/lib/types/bonus";

/**
 * Calculador de Tiempo de Bonificación para el personal de Acicalados.
 * Zona Horaria Estricta: America/Lima (UTC-5).
 */

/**
 * Obtiene los componentes de fecha y hora locales de Perú a partir de una fecha/hora dada.
 */
export function getPeruDateComponents(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0=Domingo, 1=Lunes, ..., 6=Sábado
  hours: number;
  minutes: number;
  seconds: number;
  timeStr: string;
} {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Si la cadena es solo fecha "YYYY-MM-DD" o no es válida como Date con hora, asegurar timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  // Extraer día de la semana en formato 0-6
  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", weekday: "short" }).format(d);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayOfWeek = weekdayMap[weekdayStr] ?? d.getDay();
  const hours = parseInt(partMap.hour || "0", 10);
  const minutes = parseInt(partMap.minute || "0", 10);
  const seconds = parseInt(partMap.second || "0", 10);
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    year: parseInt(partMap.year || "2026", 10),
    month: parseInt(partMap.month || "1", 10),
    day: parseInt(partMap.day || "1", 10),
    dayOfWeek,
    hours,
    minutes,
    seconds,
    timeStr,
  };
}

/**
 * Convierte una cadena de hora "HH:mm" o "HH:mm:ss" a minutos totales desde la medianoche.
 */
export function timeStringToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr || "0", 10);
  const m = parseInt(mStr || "0", 10);
  return h * 60 + m;
}

/**
 * Calcula los minutos de bonificación para un registro de asistencia dado.
 *
 * @param checkOut ISO timestamp completo o cadena de hora
 * @param dateStr Fecha del registro "YYYY-MM-DD"
 * @param customRules Reglas de bonificación configuradas (opcional, usa DEFAULT_BONUS_RULES por defecto)
 */
export function calculateBonusMinutes(
  checkOut: string | null | undefined,
  dateStr: string,
  customRules: BonusRule[] = DEFAULT_BONUS_RULES
): BonusCalculationResult {
  // Si no hay salida registrada, la bonificación es 0
  if (!checkOut) {
    return {
      bonus_minutes: 0,
      bonus_hours: 0,
      rule_applied: "Sin check-out registrado",
      bonus_start_time: "—",
      is_eligible: false,
    };
  }

  let checkOutMinutes = 0;
  let dayOfWeek = 1;

  if (checkOut.includes("T") || checkOut.includes("Z")) {
    // Timestamp ISO completo
    const comp = getPeruDateComponents(checkOut);
    checkOutMinutes = comp.hours * 60 + comp.minutes;
    dayOfWeek = comp.dayOfWeek;
  } else {
    // Cadena de hora "HH:mm" o "HH:mm:ss"
    checkOutMinutes = timeStringToMinutes(checkOut);
    // Determinar día de la semana desde dateStr
    if (dateStr) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const tempDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      dayOfWeek = tempDate.getUTCDay();
    }
  }

  // Buscar regla para este día de la semana
  const activeRule =
    customRules.find((r) => r.day_of_week === dayOfWeek && r.is_active) ||
    DEFAULT_BONUS_RULES.find((r) => r.day_of_week === dayOfWeek) ||
    {
      day_of_week: dayOfWeek,
      day_name: dayOfWeek === 0 ? "Domingo" : "Día de semana",
      bonus_start_time: dayOfWeek === 0 ? "20:10:00" : "21:10:00",
      rounding_method: "none" as const,
      is_active: true,
      id: 0,
      effective_from: "2026-01-01",
      effective_to: null,
    };

  const bonusStartMinutes = timeStringToMinutes(activeRule.bonus_start_time);

  // Fórmula: max(0, check_out_local - bonus_start_local)
  let rawDiff = Math.max(0, checkOutMinutes - bonusStartMinutes);

  // Aplicar método de redondeo si está configurado
  if (activeRule.rounding_method === "nearest_5") {
    rawDiff = Math.round(rawDiff / 5) * 5;
  } else if (activeRule.rounding_method === "floor_5") {
    rawDiff = Math.floor(rawDiff / 5) * 5;
  }

  const bonusMinutes = Math.max(0, rawDiff);
  const bonusHours = Math.round((bonusMinutes / 60) * 100) / 100;

  const dayName = activeRule.day_name || (dayOfWeek === 0 ? "Domingo" : "Lunes-Sábado");

  return {
    bonus_minutes: bonusMinutes,
    bonus_hours: bonusHours,
    rule_applied: `${dayName} (Inicia ${activeRule.bonus_start_time.slice(0, 5)})`,
    bonus_start_time: activeRule.bonus_start_time.slice(0, 5),
    is_eligible: bonusMinutes > 0,
  };
}
