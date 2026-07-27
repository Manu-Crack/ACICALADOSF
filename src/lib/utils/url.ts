/**
 * Obtiene la URL base del sitio de forma dinámica para redirecciones de autenticación (Auth / OAuth / Email Confirmation).
 * Extrae únicamente el origen (protocolo + dominio, ej. https://acicaladosf.vercel.app), incluso si la variable
 * de entorno fue configurada con rutas adicionales como /auth/login o barras al final.
 *
 * Prioridad de resolución:
 * 1. NEXT_PUBLIC_SITE_URL (Variable personalizada de producción)
 * 2. NEXT_PUBLIC_VERCEL_URL (Variable de entorno en Vercel)
 * 3. window.location.origin (Dominio dinámico en el navegador del cliente)
 * 4. http://localhost:3000 (Fallback para desarrollo local)
 */
export function getSiteURL(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "";

  if (url) {
    url = url.includes("http") ? url : `https://${url}`;
    try {
      // Extrae únicamente la raíz/origen (protocolo + host) ignorando rutas como /auth/login
      return new URL(url).origin;
    } catch {
      return url.replace(/\/$/, "");
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

/**
 * Genera la URL completa de redirección para flujos de autenticación de Supabase (OAuth o Confirmación por correo).
 * Garantiza la ruta limpia (ej: https://acicaladosf.vercel.app/auth/callback)
 */
export function getAuthRedirectURL(path: string = "/auth/callback"): string {
  const siteUrl = getSiteURL();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${cleanPath}`;
}
