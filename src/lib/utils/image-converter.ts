import { slugify } from "./slugify";

/**
 * Convierte cualquier archivo de imagen (PNG, JPG, JPEG, BMP, etc.) a formato WebP optimizado
 * directamente en el navegador del cliente antes de subirlo a Supabase Storage.
 *
 * @param file Archivo de imagen original seleccionado por el usuario
 * @param serviceName Nombre del servicio para nombrarlo sanitizado
 * @param quality Calidad de compresión WebP (0 a 1, por defecto 0.85)
 * @returns Promesa que resuelve al nuevo objeto File en formato .webp
 */
export async function convertToWebP(
  file: File,
  serviceName: string = "servicio",
  quality: number = 0.85
): Promise<File> {
  // Si ya es un archivo WebP válido y tiene nombre formateado, retornarlo directamente
  if (file.type === "image/webp" && file.name.endsWith(".webp")) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen original"));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen para la conversión WebP"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del canvas"));
          return;
        }

        // Dibujar imagen original en el canvas
        ctx.drawImage(img, 0, 0);

        // Convertir canvas a Blob en formato image/webp
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falló la conversión del canvas a Blob WebP"));
              return;
            }

            const cleanSlug = slugify(serviceName);
            const timestamp = Date.now().toString(36);
            const webpFileName = `${cleanSlug}-${timestamp}.webp`;

            const webpFile = new File([blob], webpFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          "image/webp",
          quality
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
