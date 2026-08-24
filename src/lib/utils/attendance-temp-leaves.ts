/**
 * Utilidades para Permisos Temporales por Emergencia (Temp Leaves)
 * en el Control de Asistencia de Acicalados.
 */

export interface TempLeave {
  id: string;
  leave_time: string; // Timestamp ISO
  return_time: string | null; // Timestamp ISO o null si está en curso
  reason: string;
  duration_minutes: number;
}

const TEMP_LEAVES_REGEX = /\[TEMP_LEAVES_JSON:(.+?):END_TEMP_LEAVES\]|\[TEMP_LEAVES_JSON:(\[.+?\])\]/;

/**
 * Extrae la lista de permisos temporales y las notas limpias desde el campo `notes`.
 */
export function parseTempLeavesFromNotes(notes: string | null | undefined): {
  tempLeaves: TempLeave[];
  cleanNotes: string;
} {
  if (!notes) return { tempLeaves: [], cleanNotes: "" };

  const match = notes.match(TEMP_LEAVES_REGEX);
  if (match) {
    const rawJson = match[1] || match[2];
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        const cleanNotes = notes.replace(TEMP_LEAVES_REGEX, "").trim();
        return {
          tempLeaves: Array.isArray(parsed) ? parsed : [],
          cleanNotes,
        };
      } catch {
        // Fallback
      }
    }
  }

  return { tempLeaves: [], cleanNotes: notes.trim() };
}

/**
 * Serializa la lista de permisos temporales junto con las notas de usuario en el campo `notes`.
 */
export function serializeTempLeavesToNotes(
  tempLeaves: TempLeave[],
  baseNotes?: string | null
): string | null {
  const clean = (baseNotes || "").replace(TEMP_LEAVES_REGEX, "").trim();

  if (!tempLeaves || tempLeaves.length === 0) {
    return clean || null;
  }

  const jsonTag = `[TEMP_LEAVES_JSON:${JSON.stringify(tempLeaves)}:END_TEMP_LEAVES]`;
  return clean ? `${clean}\n${jsonTag}` : jsonTag;
}

/**
 * Calcula la suma de minutos de todos los permisos temporales concluidos.
 */
export function calculateTotalTempLeaveMinutes(tempLeaves: TempLeave[]): number {
  if (!tempLeaves || tempLeaves.length === 0) return 0;
  return tempLeaves.reduce((acc, tl) => acc + (tl.duration_minutes || 0), 0);
}

/**
 * Calcula la duración efectiva/neta trabajada descontando los permisos temporales.
 */
export function calculateEffectiveWorkingMinutes(
  checkInIso: string | null | undefined,
  checkOutIso: string | null | undefined,
  notes?: string | null
): {
  grossMinutes: number;
  tempLeaveMinutes: number;
  netMinutes: number;
  formatted: string;
} {
  if (!checkInIso) {
    return { grossMinutes: 0, tempLeaveMinutes: 0, netMinutes: 0, formatted: "—" };
  }

  const endMs = checkOutIso ? new Date(checkOutIso).getTime() : Date.now();
  const startMs = new Date(checkInIso).getTime();
  const grossMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));

  const { tempLeaves } = parseTempLeavesFromNotes(notes);
  const tempLeaveMinutes = calculateTotalTempLeaveMinutes(tempLeaves);
  const netMinutes = Math.max(0, grossMinutes - tempLeaveMinutes);

  const hours = Math.floor(netMinutes / 60);
  const minutes = netMinutes % 60;

  let formatted = `${hours}h ${minutes}m`;
  if (tempLeaveMinutes > 0) {
    formatted += ` (neto, -${tempLeaveMinutes}m permiso)`;
  }

  return {
    grossMinutes,
    tempLeaveMinutes,
    netMinutes,
    formatted,
  };
}
