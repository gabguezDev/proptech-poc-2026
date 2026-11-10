/**
 * `POST /api/auth/login` — BFF.
 *
 * Recibe email y contraseña, autentica contra el backend y **traduce** el token
 * Bearer a una cookie `httpOnly`. La respuesta al navegador no incluye la
 * credencial: solo el usuario y su rol.
 */

import { iniciarSesion } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";
import { fijarSesion } from "@/lib/sesion";

export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const email = typeof cuerpo.email === "string" ? cuerpo.email : "";
  const password = typeof cuerpo.password === "string" ? cuerpo.password : "";
  if (!email || !password) {
    return errorDeValidacion("Ingresá email y contraseña.");
  }

  return responder(iniciarSesion(email, password), {
    transformar: async (credenciales) => {
      await fijarSesion(credenciales.access_token);
      return {
        email: credenciales.email,
        nombre: credenciales.nombre,
        rol: credenciales.rol,
      };
    },
  });
}
