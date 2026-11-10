/** `GET /api/perfil` — último perfil consultado del inquilino. */

import { miPerfil } from "@/lib/api";
import { responder } from "@/lib/respuesta";

export async function GET() {
  return responder(miPerfil());
}
