/**
 * Extrae la ruta relativa dentro del bucket 'services-images' a partir de una URL pública de Supabase.
 * Ej: "https://xyz.supabase.co/storage/v1/object/public/services-images/services/corte-clasico-123.webp"
 * Retorna: "services/corte-clasico-123.webp"
 */
export function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;

  if (urlOrPath.startsWith("services/")) {
    return urlOrPath;
  }

  const bucketMarker = "/services-images/";
  if (urlOrPath.includes(bucketMarker)) {
    const parts = urlOrPath.split(bucketMarker);
    return parts[1] || null;
  }

  return null;
}
