/**
 * Proxy del frontend (en Next 16 reemplaza a `middleware`).
 *
 * Corre antes de renderizar la ruta y solo decide **si se muestra o no** la
 * pantalla, en función de la presencia de la cookie de sesión. La autorización
 * real ocurre en el backend en cada request (ver `backend/src/auth.py` y la
 * sección de seguridad de la memoria): una cookie robada o falsificada no
 * entrega acceso a datos que la credencial no pueda leer.
 */

import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESION } from "./lib/env";

/** Rutas que requieren sesión. El resto es público. */
const RUTAS_PRIVADAS = [
  "/recomendaciones",
  "/descartados",
  "/favoritos",
  "/mis-inmuebles",
  "/panel",
  "/perfil",
  "/admin",
];
/** Rutas de acceso: quien ya tiene sesión no debería verlas. */
const RUTAS_DE_ACCESO = ["/ingresar", "/registrar"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tieneSesion = Boolean(request.cookies.get(COOKIE_SESION)?.value);

  if (RUTAS_PRIVADAS.some((ruta) => pathname.startsWith(ruta)) && !tieneSesion) {
    const destino = new URL("/ingresar", request.url);
    destino.searchParams.set("vuelve", pathname);
    return NextResponse.redirect(destino);
  }

  if (RUTAS_DE_ACCESO.some((ruta) => pathname.startsWith(ruta)) && tieneSesion) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
