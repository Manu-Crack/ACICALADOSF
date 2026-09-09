import {
  normalizeSearchText,
  matchesServiceSearch,
  sortServicesByOrder,
  filterAndSortServices,
  ServiceSearchable,
} from "@/lib/utils/service-search";

// Catálogo de prueba basado en datos reales del sistema Acicalados
const mockServices: ServiceSearchable[] = [
  {
    id: "svc-1",
    name: "TINTE COLOR ENTERO",
    type: "spa",
    price_cents: 12000, // S/ 120.00
    sort_order: 0,
    created_at: "2026-07-27T05:09:33.000Z",
  },
  {
    id: "svc-2",
    name: "CORTE CLÁSICO",
    type: "barberia",
    price_cents: 2000, // S/ 20.00
    sort_order: 0,
    created_at: "2026-07-27T05:09:34.000Z",
  },
  {
    id: "svc-3",
    name: "CORTE FADE",
    type: "barberia",
    price_cents: 2500, // S/ 25.00
    sort_order: 0,
    created_at: "2026-07-27T05:09:35.000Z",
  },
  {
    id: "svc-4",
    name: "DEPILACIÓN DE CEJAS CON CERA",
    type: "spa",
    price_cents: 2500, // S/ 25.00
    sort_order: 1,
    created_at: "2026-08-26T19:09:45.000Z",
  },
  {
    id: "svc-5",
    name: "PEDICURE",
    type: "spa",
    price_cents: 4000, // S/ 40.00
    sort_order: 1,
    created_at: "2026-07-27T05:09:36.000Z",
  },
  {
    id: "svc-6",
    name: "BLANQUEAMIENTO CORPORAL",
    type: "spa",
    price_cents: 3000, // S/ 30.00
    sort_order: 2,
    created_at: "2026-08-14T20:52:52.000Z",
  },
  {
    id: "svc-7",
    name: "DEPILACIÓN (PIERNA)",
    type: "spa",
    price_cents: 5000, // S/ 50.00
    sort_order: 3,
    created_at: "2026-07-27T05:09:37.000Z",
  },
  {
    id: "svc-8",
    name: "ACRIPIE COMPLETO",
    type: "spa",
    price_cents: 6000, // S/ 60.00
    sort_order: 4,
    created_at: "2026-07-27T05:09:38.000Z",
  },
  {
    id: "svc-9",
    name: "FACIAL BÁSICO",
    type: "spa",
    price_cents: 5000, // S/ 50.00
    sort_order: 5,
    created_at: "2026-07-27T05:09:39.000Z",
  },
  {
    id: "svc-10",
    name: "RIZADO DE PESTAÑAS",
    type: "spa",
    price_cents: 3500, // S/ 35.00
    sort_order: 6,
    created_at: "2026-07-27T05:09:40.000Z",
  },
  {
    id: "svc-11",
    name: "BOTOX DE 80",
    type: "spa",
    price_cents: 8000, // S/ 80.00
    sort_order: 7,
    created_at: "2026-07-27T05:09:41.000Z",
  },
  {
    id: "svc-12",
    name: "BOTOX DE 150",
    type: "spa",
    price_cents: 15000, // S/ 150.00
    sort_order: 8,
    created_at: "2026-07-27T05:09:42.000Z",
  },
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
  }
}

console.log("==========================================================================");
console.log(" 🧪 AUDITORÍA: BUSCADOR INTELIGENTE Y FILTRADO MULTICRITERIO DE SERVICIOS");
console.log("==========================================================================");

// --- 1. Normalización de Texto e Insensibilidad a Mayúsculas y Tildes ---
console.log("\n--- 1. Normalización e Insensibilidad a Mayúsculas/Tildes ---");
{
  assert(normalizeSearchText("Corte Clásico") === "corte clasico", "Normaliza acento 'á' en 'a'");
  assert(normalizeSearchText("BÁSICO") === "basico", "Normaliza mayúsculas con tilde 'Á'");
  assert(normalizeSearchText("DEPILACIÓN") === "depilacion", "Normaliza 'Ó' a 'o'");
  assert(normalizeSearchText("RIZADO DE PESTAÑAS") === "rizado de pestanas", "Normaliza 'Ñ' a 'n'");
  assert(normalizeSearchText("   Fade   ") === "fade", "Elimina espacios en blanco superfluos");
}

// --- 2. Búsqueda por Texto (Nombre) ---
console.log("\n--- 2. Búsqueda por Texto (Nombre del Servicio) ---");
{
  // Búsqueda por prefijo "cor"
  const resCor = filterAndSortServices(mockServices, "all", "cor");
  const namesCor = resCor.map((s) => s.name);
  assert(
    namesCor.includes("CORTE CLÁSICO") && namesCor.includes("CORTE FADE"),
    "Búsqueda por 'cor' encuentra 'CORTE CLÁSICO' y 'CORTE FADE'"
  );

  // Búsqueda insensible a tildes: usuario escribe "clasico" (sin tilde)
  const resClasicoSinTilde = filterAndSortServices(mockServices, "all", "clasico");
  assert(
    resClasicoSinTilde.some((s) => s.name === "CORTE CLÁSICO"),
    "Buscar 'clasico' (sin tilde) encuentra 'CORTE CLÁSICO' (con tilde)"
  );

  // Búsqueda con tildes: usuario escribe "clásico" (con tilde)
  const resClasicoConTilde = filterAndSortServices(mockServices, "all", "clásico");
  assert(
    resClasicoConTilde.some((s) => s.name === "CORTE CLÁSICO"),
    "Buscar 'clásico' (con tilde) encuentra 'CORTE CLÁSICO'"
  );

  // Búsqueda insensible a diacríticos: "pestanas" vs "PESTAÑAS"
  const resPestanas = filterAndSortServices(mockServices, "all", "pestanas");
  assert(
    resPestanas.some((s) => s.name === "RIZADO DE PESTAÑAS"),
    "Buscar 'pestanas' encuentra 'RIZADO DE PESTAÑAS'"
  );

  // Búsqueda insensible a diacríticos: "pestañas" vs "PESTAÑAS"
  const resPestanasConTilde = filterAndSortServices(mockServices, "all", "pestañas");
  assert(
    resPestanasConTilde.some((s) => s.name === "RIZADO DE PESTAÑAS"),
    "Buscar 'pestañas' con tilde encuentra 'RIZADO DE PESTAÑAS'"
  );
}

// --- 3. Búsqueda Numérica por Tarifa / Precio ---
console.log("\n--- 3. Búsqueda Numérica (Tarifa / Precio) ---");
{
  // Búsqueda por importe "20"
  // Debe coincidir con CORTE CLÁSICO (S/ 20.00) y también los que contengan "20" (ej: TINTE COLOR ENTERO S/ 120.00)
  const res20 = filterAndSortServices(mockServices, "all", "20");
  const names20 = res20.map((s) => s.name);
  assert(
    names20.includes("CORTE CLÁSICO"),
    "Búsqueda por '20' incluye servicio con precio S/ 20.00"
  );
  assert(
    names20.includes("TINTE COLOR ENTERO"),
    "Búsqueda por '20' incluye servicio con precio S/ 120.00 (contiene cifra 20)"
  );

  // Búsqueda por importe "50"
  const res50 = filterAndSortServices(mockServices, "all", "50");
  const names50 = res50.map((s) => s.name);
  assert(
    names50.includes("DEPILACIÓN (PIERNA)"),
    "Búsqueda por '50' incluye 'DEPILACIÓN (PIERNA)' (precio S/ 50.00)"
  );
  assert(
    names50.includes("FACIAL BÁSICO"),
    "Búsqueda por '50' incluye 'FACIAL BÁSICO' (precio S/ 50.00)"
  );
  assert(
    names50.includes("BOTOX DE 150"),
    "Búsqueda por '50' incluye 'BOTOX DE 150' (precio S/ 150.00 contiene '50')"
  );

  // Búsqueda con formato de moneda "S/ 20" o "s/ 20.00"
  const resMoneda = filterAndSortServices(mockServices, "all", "S/ 20");
  assert(
    resMoneda.some((s) => s.name === "CORTE CLÁSICO"),
    "Búsqueda con prefijo de moneda 'S/ 20' encuentra precio S/ 20.00"
  );

  const resDecimal = filterAndSortServices(mockServices, "all", "20.00");
  assert(
    resDecimal.some((s) => s.name === "CORTE CLÁSICO"),
    "Búsqueda con decimales '20.00' encuentra precio S/ 20.00"
  );

  // Búsqueda simultánea: "80" coincide tanto por texto en "BOTOX DE 80" como por precio 80.00
  const res80 = filterAndSortServices(mockServices, "all", "80");
  assert(
    res80.some((s) => s.name === "BOTOX DE 80"),
    "Búsqueda '80' encuentra 'BOTOX DE 80' (coincidencia de texto y precio)"
  );
}

// --- 4. Respeto al Orden Numérico Establecido (sort_order de Menor a Mayor) ---
console.log("\n--- 4. Respeto Estricto a la Secuencia Numérica (sort_order) ---");
{
  // Lista general completa ordenada
  const allSorted = filterAndSortServices(mockServices, "all", "");
  let isStrictlyAscending = true;
  for (let i = 1; i < allSorted.length; i++) {
    if (allSorted[i].sort_order < allSorted[i - 1].sort_order) {
      isStrictlyAscending = false;
      break;
    }
  }
  assert(isStrictlyAscending, "La lista general se ordena de menor a mayor por sort_order (0, 1, 2, ...)");

  // Resultados filtrados deben mantener esa jerarquía
  const filteredFadeOrDepilacion = filterAndSortServices(mockServices, "all", "depilacion");
  let filteredAscending = true;
  for (let i = 1; i < filteredFadeOrDepilacion.length; i++) {
    if (filteredFadeOrDepilacion[i].sort_order < filteredFadeOrDepilacion[i - 1].sort_order) {
      filteredAscending = false;
      break;
    }
  }
  assert(filteredAscending, "Los resultados filtrados mantienen la jerarquía de menor a mayor por sort_order");
  assert(
    filteredFadeOrDepilacion[0].sort_order <= filteredFadeOrDepilacion[1].sort_order,
    `Primer resultado (Orden ${filteredFadeOrDepilacion[0].sort_order}) <= Segundo (Orden ${filteredFadeOrDepilacion[1].sort_order})`
  );
}

// --- 5. Combinación con Filtro por Categoría (Barbería / Spa) ---
console.log("\n--- 5. Filtro Combinado por Categoría y Búsqueda ---");
{
  // En Barbería con búsqueda "25" debe encontrar solo CORTE FADE (S/ 25.00), no DEPILACIÓN DE CEJAS (S/ 25.00 Spa)
  const resBarberia25 = filterAndSortServices(mockServices, "barberia", "25");
  assert(
    resBarberia25.length === 1 && resBarberia25[0].name === "CORTE FADE",
    "Filtro 'barberia' con búsqueda '25' retorna únicamente 'CORTE FADE'"
  );

  // En Spa con búsqueda "25" debe encontrar DEPILACIÓN DE CEJAS CON CERA
  const resSpa25 = filterAndSortServices(mockServices, "spa", "25");
  assert(
    resSpa25.some((s) => s.name === "DEPILACIÓN DE CEJAS CON CERA") &&
      !resSpa25.some((s) => s.type === "barberia"),
    "Filtro 'spa' con búsqueda '25' excluye servicios de barbería"
  );
}

// --- 6. Casos Límite y Estado Sin Coincidencias ---
console.log("\n--- 6. Casos Límite y Búsqueda Sin Coincidencias ---");
{
  const resNoMatch = filterAndSortServices(mockServices, "all", "termino_inexistente_xyz");
  assert(resNoMatch.length === 0, "Búsqueda sin coincidencias retorna arreglo vacío");

  const resWhitespace = filterAndSortServices(mockServices, "all", "   ");
  assert(resWhitespace.length === mockServices.length, "Búsqueda con espacios en blanco preserva lista completa");

  // Inmutabilidad de los objetos originales
  const originalCents = mockServices[0].price_cents;
  filterAndSortServices(mockServices, "all", "20");
  assert(mockServices[0].price_cents === originalCents, "Los datos de los servicios originales NO sufren modificaciones");
}

console.log("\n==========================================================================");
console.log(` 🏁 RESULTADO: ${passed} pasadas, ${failed} falladas.`);
console.log("==========================================================================");

if (failed > 0) {
  process.exit(1);
}
