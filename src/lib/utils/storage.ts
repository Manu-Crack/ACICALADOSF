/**
 * Extrae la ruta relativa dentro de cualquier bucket de Supabase Storage a partir de una URL pública.
 * Ej: "https://xyz.supabase.co/storage/v1/object/public/wardrobe-images/wardrobe/traje-123.webp"
 * Retorna: "wardrobe/traje-123.webp"
 */
export function extractStoragePath(urlOrPath: string, bucketName?: string): string | null {
  if (!urlOrPath) return null;

  if (urlOrPath.startsWith("services/") || urlOrPath.startsWith("wardrobe/") || urlOrPath.startsWith("products/")) {
    return urlOrPath;
  }

  if (bucketName) {
    const bucketMarker = `/${bucketName}/`;
    if (urlOrPath.includes(bucketMarker)) {
      const parts = urlOrPath.split(bucketMarker);
      return parts[1] || null;
    }
  }

  // Coincidencia genérica para cualquier bucket público en Supabase Storage
  const match = urlOrPath.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}
