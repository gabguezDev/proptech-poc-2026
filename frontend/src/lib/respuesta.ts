/**
 * Respuestas homogéneas del BFF.
 *
 * El navegador recibe `{ error, estado }` con el mismo código HTTP que devolvió
 * el backend, y nunca la credencial: el token se traduce a una cookie `httpOnly`
 * en el route handler de autenticación.
 */

import { NextResponse } from "next/server";

import { ErrorApi } from "./tipo";

/** Opciones del envoltorio. */
interface Opciones<T, R = T> {
  /** Status cuando la llamada tuvo éxito (por defecto 200). */
  estadoExito?: number;
  /** Transforma el dato del backend antes de responderlo al navegador. */
  transformar?: (datos: T) => R | Promise<R>;
}

/**
 * Envuelve una llamada al backend:
 *  - `ErrorApi` -> se propaga el código de estado con el mensaje de FastAPI;
 *  - otro error (backend caído) -> 502;
 *  - éxito -> `transformar(datos)` con `estadoExito`.
 */
export async function responder<T, R = T>(
  accion: Promise<T>,
  opciones: Opciones<T, R> = {},
): Promise<NextResponse> {
  try {
    const datos = await accion;
    const cuerpo = opciones.transformar
      ? await opciones.transformar(datos)
      : datos;
    return NextResponse.json(cuerpo, { status: opciones.estadoExito ?? 200 });
  } catch (error) {
    if (error instanceof ErrorApi) {
      return NextResponse.json(
        { error: error.message, estado: error.estado },
        { status: error.estado },
      );
    }
    return NextResponse.json(
      {
        error: "No se pudo comunicar con el backend. Verificá que esté levantado.",
        estado: 502,
      },
      { status: 502 },
    );
  }
}

/** Lee el JSON del request, tolerando cuerpos vacíos. */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 400 estándar del BFF (validación de entrada antes de llamar al backend). */
export function errorDeValidacion(mensaje: string): NextResponse {
  return NextResponse.json({ error: mensaje, estado: 400 }, { status: 400 });
}
