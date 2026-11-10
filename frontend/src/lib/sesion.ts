/**
 * Gestión de la cookie de sesión del frontend.
 *
 * Decisión de diseño (ver la sección de Seguridad de la memoria): la fuente de
 * verdad del estado de sesión es el **backend**, que guarda credenciales opacas
 * con vencimiento y las revoca. La cookie `httpOnly` es solo el **transporte**
 * de esa credencial hasta el servidor de Next.js; no almacena la sesión ni es
 * legible desde el JavaScript del navegador.
 */

import { cookies } from "next/headers";

import { COOKIE_SESION, EDAD_MAXIMA_COOKIE } from "./env";

/**
 * Fija la cookie con la credencial opaca devuelta por el backend.
 * Con `recordar` en false es cookie de sesión (muere al cerrar el navegador);
 * el token del servidor sigue teniendo su vencimiento propio.
 */
export async function fijarSesion(token: string, recordar = true): Promise<void> {
  const almacén = await cookies();
  almacén.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(recordar ? { maxAge: EDAD_MAXIMA_COOKIE } : {}),
  });
}

/** Borra la cookie (la revocación real ocurre en el backend). */
export async function limpiarSesion(): Promise<void> {
  const almacén = await cookies();
  almacén.delete(COOKIE_SESION);
}
