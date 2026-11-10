/** `GET /api/propiedades/[idInmueble]/visitas` — solicitantes y confirmaciones. */

import { listarVisitas } from "@/lib/api";
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
  return responder(listarVisitas(idInmueble));
}
