/**
 * `GET/POST /api/propiedades/[idInmueble]/validar` — validación de afirmaciones.
 *
 * GET: refutaciones pendientes y validaciones realizadas.
 * POST: valida una afirmación refutada subiendo una foto (multipart) con la
 * ubicación medida (GPS de la foto o enviada).
 */

import { listarValidaciones, validarAfirmacion } from "@/lib/api";
import { errorDeValidacion, responder } from "@/lib/respuesta";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  return responder(listarValidaciones(idInmueble));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  let cuerpo: FormData;
  try {
    cuerpo = await request.formData();
  } catch {
    return errorDeValidacion("Cuerpo multipart inválido.");
  }
  const detalle = String(cuerpo.get("detalle") ?? "").trim();
  const foto = cuerpo.get("foto");
  if (!detalle || !(foto instanceof File)) {
    return errorDeValidacion("Faltan detalle y foto.");
  }
  const lat = Number(cuerpo.get("lat"));
  const lon = Number(cuerpo.get("lon"));
  return responder(
    validarAfirmacion(idInmueble, {
      detalle,
      foto,
      lat: Number.isFinite(lat) && cuerpo.get("lat") != null ? lat : undefined,
      lon: Number.isFinite(lon) && cuerpo.get("lon") != null ? lon : undefined,
    }),
    { estadoExito: 201 },
  );
}
