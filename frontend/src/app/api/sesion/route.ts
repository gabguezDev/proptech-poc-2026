/** `GET /api/sesion` — usuario de la sesión actual (401 si no la hay). */

import { usuarioActual } from "@/lib/api";
import { responder } from "@/lib/respuesta";
import { NextResponse } from "next/server";

export async function GET() {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "Sin sesión activa", estado: 401 },
      { status: 401 },
    );
  }
  return responder(Promise.resolve({ usuario }));
}
