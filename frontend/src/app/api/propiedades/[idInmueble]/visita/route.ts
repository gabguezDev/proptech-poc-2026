/**
 * `POST /api/propiedades/[idInmueble]/visita` — confirmar la visita de un
 * inquilino (solo el dueño/agente). Reenvía al backend con la sesión.
 */

import { confirmarVisita } from "@/lib/api";
import { errorDeValidacion, leerCuerpo, responder } from "@/lib/respuesta";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  const cuerpo = await leerCuerpo(request);
  const email = typeof cuerpo.usuario_email === "string" ? cuerpo.usuario_email : "";
  if (!email) {
    return errorDeValidacion("Falta el email del inquilino.");
  }
  return responder(confirmarVisita(idInmueble, email), { estadoExito: 201 });
}
