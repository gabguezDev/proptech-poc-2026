/**
 * `POST /api/feedback` y `GET /api/feedback` — BFF del lado del inquilino.
 *
 *  - `POST` registra un feedback (`favorito`, `me_gusta`, `no_me_gusta`, `visto`,
 *    `contacto`, `visita_solicitada`) sobre un inmueble.
 *  - `GET` lista el feedback del usuario; con `?tipo=no_me_gusta` devuelve la
 *    "zona de descartados" (se revierte con `DELETE /api/feedback/[id]`).
 */

import { miFeedback, registrarFeedback } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";
import { TIPOS_FEEDBACK, type TipoFeedback } from "@/lib/tipo";

export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const idInmueble = Number(cuerpo.id_inmueble);
  const tipo = cuerpo.tipo as TipoFeedback | undefined;

  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Falta id_inmueble.");
  }
  if (!tipo || !TIPOS_FEEDBACK.includes(tipo)) {
    return errorDeValidacion("Tipo de feedback inválido.");
  }

  return responder(
    registrarFeedback(
      idInmueble,
      tipo,
      typeof cuerpo.detalle === "string" ? cuerpo.detalle : undefined,
    ),
    { estadoExito: 201 },
  );
}

export async function GET(request: Request) {
  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo && !TIPOS_FEEDBACK.includes(tipo as TipoFeedback)) {
    return errorDeValidacion("Tipo de feedback inválido.");
  }
  return responder(miFeedback((tipo as TipoFeedback | undefined) ?? undefined));
}
