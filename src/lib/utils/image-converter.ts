import { slugify } from "./slugify";

export type WebPConvertOptions = {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  fitVertical?: boolean; // Ajuste óptimo para dimensiones 1080 x 1920
};

/**
 * Convierte cualquier archivo de imagen (PNG, JPG, JPEG, BMP, etc.) a formato WebP optimizado
 * directamente en el navegador del cliente antes de subirlo a Supabase Storage.
 *
 * @param file Archivo de imagen original seleccionado por el usuario
 * @param namePrefix Prefijo o nombre para sanitizar el archivo
 * @param quality Calidad de compresión WebP (0 a 1, por defecto 0.88)
 * @param options Opciones avanzadas de redimensionamiento (ej. 1080x1920)
 * @returns Promesa que resuelve al nuevo objeto File en formato .webp
 */
export async function convertToWebP(
  file: File,
  namePrefix: string = "imagen",
  quality: number = 0.88,
  options?: WebPConvertOptions
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen original"));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen para la conversión WebP"));
      img.onload = () => {
        let targetWidth = img.naturalWidth || img.width;
        let targetHeight = img.naturalHeight || img.height;

        const maxWidth = options?.maxWidth || 1080;
        const maxHeight = options?.maxHeight || 1920;

        // Si se especifican límites de tamaño, redimensionar manteniendo proporción
        if (targetWidth > maxWidth || targetHeight > maxHeight) {
          const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del canvas"));
          return;
        }

        // Suavizado de imagen de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Dibujar imagen original redimensionada en el canvas
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convertir canvas a Blob en formato image/webp
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falló la conversión del canvas a Blob WebP"));
              return;
            }

            const cleanSlug = slugify(namePrefix || "item");
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).slice(2, 6);
            const webpFileName = `${cleanSlug}-${timestamp}-${random}.webp`;

            const webpFile = new File([blob], webpFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          "image/webp",
          options?.quality ?? quality
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
