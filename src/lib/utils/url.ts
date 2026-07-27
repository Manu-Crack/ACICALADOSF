/**
 * Obtiene la URL base del sitio de forma dinámica para redirecciones de autenticación (Auth / OAuth / Email Confirmation).
 * Prioridad:
 * 1. NEXT_PUBLIC_SITE_URL (Variable de entorno personalizada de producción, ej. https://acicalados.pe)
 * 2. NEXT_PUBLIC_VERCEL_URL (Variable automática inyectada por Vercel, ej. acicalados-app.vercel.app)
 * 3. window.location.origin (Dominio dinámico en el navegador del cliente)
 * 4. http://localhost:3000 (Fallback para entorno local)
 */
export function getSiteURL(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "";

  if (url) {
    url = url.includes("http") ? url : `https://${url}`;
    return url.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

/**
 * Genera la URL completa de redirección para flujos de autenticación de Supabase (OAuth o Confirmación por correo)
 */
export function getAuthRedirectURL(path: string = "/auth/callback"): string {
  const siteUrl = getSiteURL();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${cleanPath}`;
}
