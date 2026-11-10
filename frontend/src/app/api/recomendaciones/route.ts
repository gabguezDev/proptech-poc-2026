/**
 * `POST /api/recomendaciones` — BFF sobre `POST /recommend`.
 *
 * Recibe el perfil del inquilino (`UserPreferences`) y devuelve el ranking con
 * el desglose explicativo. Requiere sesión: sin cookie válida el backend
 * responde 401 y el BFF lo propaga.
 */

import { recomendar } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";
import type { PreferenciasUsuario } from "@/lib/tipo";

export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const perfil = cuerpo.perfil as PreferenciasUsuario | undefined;
  const topK = typeof cuerpo.top_k === "number" ? cuerpo.top_k : 5;

  if (!perfil || typeof perfil.lat_trabajo !== "number" ||
      typeof perfil.lon_trabajo !== "number") {
    return errorDeValidacion("El perfil requiere lat_trabajo y lon_trabajo.");
  }

  return responder(recomendar(perfil, topK));
}
