/**
 * Utilidades para búsqueda inteligente y ordenamiento de servicios
 * Soporta coincidencia insensible a mayúsculas/minúsculas y tildes,
 * búsqueda numérica por precio/tarifa y ordenamiento estricto por posición oficial (sort_order).
 */

export type ServiceSearchable = {
  id: string;
  name: string;
  description?: string | null;
  type: "barberia" | "spa" | string;
  price_cents: number;
  sort_order: number;
  created_at?: string;
  [key: string]: unknown;
};

/**
 * Normaliza un texto convirtiéndolo a minúsculas y removiendo acentos/tildes
 * (diacríticos) para permitir búsquedas insensibles a la acentuación.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Determina si un servicio coincide con el término de búsqueda ingresado.
 * Criterios simultáneos:
 * 1. Texto (Nombre): coincidencia parcial insensible a mayúsculas y tildes.
 * 2. Número (Precio): si la consulta incluye números o formato de moneda,
 *    compara contra el precio en Soles (entero, decimal o coincidencia de cifras).
 */
export function matchesServiceSearch(
  service: ServiceSearchable,
  rawQuery: string
): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const normalizedQuery = normalizeSearchText(query);

  // 1. Coincidencia por texto en el Nombre del servicio
  const normalizedName = normalizeSearchText(service.name);
  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  // Coincidencia secundaria opcional en la descripción
  if (service.description) {
    const normalizedDesc = normalizeSearchText(service.description);
    if (normalizedDesc.includes(normalizedQuery)) {
      return true;
    }
  }

  // 2. Coincidencia por Número (Monto / Precio)
  // Limpiar prefijos de moneda como "s/", "s/.", "$", "soles", etc.
  const cleanedQuery = query
    .toLowerCase()
    .replace(/^(s\/\.?\s*|\$\s*|soles\s*)/i, "")
    .replace(/\s*(soles|pen)$/i, "")
    .trim();

  // Verificar si la consulta contiene al menos un dígito
  if (/\d/.test(cleanedQuery)) {
    const priceSolesNumber = service.price_cents / 100;
    const priceSolesIntStr = Math.floor(priceSolesNumber).toString();
    const priceSolesExactStr = priceSolesNumber.toString();
    const priceFormattedTwoDecimals = priceSolesNumber.toFixed(2);

    // Si el usuario escribió un número exacto (ej. "20", "25", "100.5")
    const parsedQueryNumber = parseFloat(cleanedQuery);
    if (!isNaN(parsedQueryNumber) && Math.abs(priceSolesNumber - parsedQueryNumber) < 0.001) {
      return true;
    }

    // Coincidencia si el precio contiene esa cifra (ej. "20" en 20, 120, 200, 20.00)
    // Extraer solo la secuencia de dígitos y puntos de la consulta limpia
    const queryDigits = cleanedQuery.replace(/[^\d.]/g, "");
    if (queryDigits.length > 0) {
      if (
        priceSolesIntStr.includes(queryDigits) ||
        priceSolesExactStr.includes(queryDigits) ||
        priceFormattedTwoDecimals.includes(queryDigits)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Ordena la lista de servicios de menor a mayor según la secuencia del
 * número de orden oficial (sort_order), con desempate estable por fecha
 * de creación o nombre.
 */
export function sortServicesByOrder<T extends ServiceSearchable>(services: T[]): T[] {
  return [...services].sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Desempate estable por fecha de creación (de más antiguo a más reciente)
    if (a.created_at && b.created_at) {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }
    }

    // Desempate final alfabético por nombre
    return (a.name || "").localeCompare(b.name || "", "es", { sensitivity: "base" });
  });
}

/**
 * Filtra y ordena una lista de servicios según el tipo seleccionado y la consulta de búsqueda.
 */
export function filterAndSortServices<T extends ServiceSearchable>(
  services: T[],
  categoryFilter: "all" | "barberia" | "spa",
  searchQuery: string
): T[] {
  // 1. Filtrar por categoría (todos / barbería / spa)
  const categoryFiltered =
    categoryFilter === "all"
      ? services
      : services.filter((s) => s.type === categoryFilter);

  // 2. Filtrar por criterio de búsqueda (nombre o precio)
  const searchFiltered = searchQuery.trim()
    ? categoryFiltered.filter((s) => matchesServiceSearch(s, searchQuery))
    : categoryFiltered;

  // 3. Respetar estrictamente la jerarquía ordenada de menor a mayor
  return sortServicesByOrder(searchFiltered);
}
