/**
 * `POST /api/auth/logout` — BFF.
 *
 * Revoca la credencial en el backend y borra la cookie. Si el backend ya no
 * reconoce el token (revocado o expirado), la sesión igual se cierra del lado
 * del navegador: el objetivo es dejar de transportar una credencial inválida.
 */

import { cerrarSesion, tokenDesdeCookie } from "@/lib/api";
import { responder } from "@/lib/respuesta";
import { limpiarSesion } from "@/lib/sesion";
import { ErrorApi } from "@/lib/tipo";

export async function POST() {
  const token = await tokenDesdeCookie();
  return responder(
    (async () => {
      try {
        await cerrarSesion(token);
      } catch (error) {
        if (!(error instanceof ErrorApi) || error.estado !== 401) throw error;
      }
      await limpiarSesion();
      return { ok: true };
    })(),
  );
}
