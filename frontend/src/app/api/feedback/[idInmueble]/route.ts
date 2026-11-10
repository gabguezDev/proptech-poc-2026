/**
 * `DELETE /api/feedback/[idInmueble]` — revierte el feedback del inquilino.
 *
 * Sin `?tipo=` quita todo el feedback del usuario sobre el inmueble; con él,
 * quita solo ese tipo (p. ej. revertir un "no me gusta" para que vuelva al
 * ranking). El backend responde 404 si no había nada que quitar.
 */

import { revertirFeedback } from "@/lib/api";
import { errorDeValidacion, responder } from "@/lib/respuesta";
import { TIPOS_FEEDBACK, type TipoFeedback } from "@/lib/tipo";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }

  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo && !TIPOS_FEEDBACK.includes(tipo as TipoFeedback)) {
    return errorDeValidacion("Tipo de feedback inválido.");
  }

  return responder(
    revertirFeedback(idInmueble, (tipo as TipoFeedback | undefined) ?? undefined),
  );
}
