/**
 * `PUT /api/propiedades/[idInmueble]` — edición parcial de un inmueble
 * (p. ej. publicar un borrador). Reenvía el cuerpo al backend.
 */

import { actualizarPropiedad, obtenerPropiedad } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";

/** `GET /api/propiedades/[idInmueble]` — detalle público de una propiedad. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  return responder(obtenerPropiedad(idInmueble));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  const cuerpo = await leerCuerpo(request);
  return responder(actualizarPropiedad(idInmueble, cuerpo));
}
