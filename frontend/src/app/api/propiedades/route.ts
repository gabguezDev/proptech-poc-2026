/**
 * `GET /api/propiedades` — catálogo público (incluye `score_carga`).
 *
 * No necesita credencial, pero con Cache Components un handler que no usa APIs
 * de request se prerenderizaría en el build y quedaría congelado: `connection()`
 * lo obliga a resolverse en cada pedido, que es lo que tiene sentido para un
 * catálogo que los oferentes editan.
 */

import { connection } from "next/server";

import { crearPropiedad, listarPropiedades } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";

export async function GET() {
  await connection();
  return responder(listarPropiedades());
}

/**
 * `POST /api/propiedades` — alta de un inmueble del lado oferta.
 * Reenvía el cuerpo tal cual al backend, que asigna la propiedad según el rol.
 */
export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  if (typeof cuerpo.precio !== "number" || typeof cuerpo.lat !== "number") {
    return errorDeValidacion("El alta requiere precio y coordenadas (lat/lon).");
  }
  return responder(crearPropiedad(cuerpo), { estadoExito: 201 });
}
