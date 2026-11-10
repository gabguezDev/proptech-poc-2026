/**
 * Configuración del BFF (Backend for Frontend).
 *
 * El navegador nunca ve la credencial de la API: el token opaco vive en una
 * cookie `httpOnly` del frontend y es el servidor de Next.js quien llama a
 * FastAPI. Por eso `BACKEND_URL` es una variable de servidor.
 */

/** URL base del backend FastAPI (en docker: http://backend:8000). */
export const BACKEND_URL = procesarUrl(
  process.env.BACKEND_URL ?? "http://localhost:8000",
);

/** Nombre de la cookie que transporta la credencial de sesión opaca. */
export const COOKIE_SESION = "proptech_sesion";

/** Tiempo de vida de la cookie (7 días, en línea con el TTL del backend). */
export const EDAD_MAXIMA_COOKIE = 60 * 60 * 24 * 7;

/** Quita la barra final para no duplicar "//" al armar rutas. */
function procesarUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
