/** `POST /api/auth/registro` — BFF: crea la cuenta y abre la sesión. */

import { registrarUsuario } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";
import { fijarSesion } from "@/lib/sesion";

const ROLES_PERMITIDOS = ["seeker", "prop_owner", "real_estate_agent"];

export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const email = typeof cuerpo.email === "string" ? cuerpo.email : "";
  const password = typeof cuerpo.password === "string" ? cuerpo.password : "";
  const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre : undefined;
  const rol = typeof cuerpo.rol === "string" ? cuerpo.rol : "seeker";

  if (!email || !password) {
    return errorDeValidacion("Ingresá email y contraseña.");
  }
  if (password.length < 8) {
    return errorDeValidacion("La contraseña debe tener al menos 8 caracteres.");
  }
  if (!ROLES_PERMITIDOS.includes(rol)) {
    return errorDeValidacion("Rol inválido para autorregistro.");
  }

  return responder(registrarUsuario({ email, password, nombre, rol }), {
    estadoExito: 201,
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
