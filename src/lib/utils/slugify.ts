/**
 * Convierte un texto (ej. nombre de servicio) a un slug limpio y seguro para rutas de archivos/URLs.
 * Ej: "Corte Clásico + Diseño (Especial)" => "corte-clasico-diseno-especial"
 */
export function slugify(text: string): string {
  if (!text) return "servicio";

  const slug = text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "servicio";
}
