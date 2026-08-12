/**
 * Utilidades de formato para la aplicación Acicalados
 */

/**
 * Convierte una duración en minutos a una representación amigable en español.
 * 
 * Reglas de conversión:
 * - < 60 min: "X min" (ej. "30 min", "45 min")
 * - 60 min a < 1440 min (menos de 24h):
 *   - Horas exactas: "1 hora", "2 horas", "4 horas"
 *   - Horas con minutos: "1h 30 min", "2h 15 min"
 * - >= 1440 min (24h o más):
 *   - Días/semanas exactas: "1 día", "2 días", "3 días", "1 semana", "2 semanas"
 *   - Días con horas/minutos: "1 día 2h", "1 día 2h 30 min"
 * 
 * @param minutes Duración en minutos
 * @returns Cadena de texto formateada
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes <= 0) {
    return "0 min";
  }

  const totalMinutes = Math.round(minutes);

  // Menor a 60 minutos
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  // Menor a 24 horas (1440 minutos)
  if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;

    if (remainingMins === 0) {
      return hours === 1 ? "1 hora" : `${hours} horas`;
    }
    return `${hours}h ${remainingMins} min`;
  }

  // 24 horas o más
  const days = Math.floor(totalMinutes / 1440);
  const remainingAfterDays = totalMinutes % 1440;
  const hours = Math.floor(remainingAfterDays / 60);
  const remainingMins = remainingAfterDays % 60;

  // Días exactos (sin horas ni minutos sobrantes)
  if (remainingAfterDays === 0) {
    // Si son múltiplos exactos de 7 días (semanas)
    if (days >= 7 && days % 7 === 0) {
      const weeks = days / 7;
      return weeks === 1 ? "1 semana" : `${weeks} semanas`;
    }
    return days === 1 ? "1 día" : `${days} días`;
  }

  // Días con horas y/o minutos restantes
  const dayStr = days === 1 ? "1 día" : `${days} días`;
  const parts = [dayStr];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (remainingMins > 0) {
    parts.push(`${remainingMins} min`);
  }

  return parts.join(" ");
}
