/**
 * Etiquetado de fotos por ambiente.
 *
 * Las fotos de una publicación pueden ser URLs planas (legacy, sin etiqueta)
 * u objetos `{ url, ambiente, numero, ... }`. Estos helpers normalizan el
 * acceso desde las galerías y la subida.
 */

import type { FotoPublicacion } from "@/lib/tipo";

/** URL pública de una foto (plana o etiquetada). */
export function urlFoto(foto: string | FotoPublicacion): string {
  return typeof foto === "string" ? foto : foto.url;
}

/** ¿La foto está etiquetada por ambiente? */
export function esEtiquetada(
  foto: string | FotoPublicacion,
): foto is FotoPublicacion {
  return typeof foto !== "string";
}

/** Nombre legible del ambiente (para selects y listas). */
export const NOMBRES_AMBIENTE: Record<string, string> = {
  living: "Living",
  comedor: "Comedor",
  cocina: "Cocina",
  dormitorio: "Dormitorio",
  bano: "Baño",
  lavadero: "Lavadero",
  patio: "Patio",
  patio_interno: "Patio interno",
  balcon: "Balcón",
  cochera: "Cochera",
  vista: "Vista",
  amenities: "Amenities",
  otros: "Otros",
};

/** Ambientes del enum cerrado (mismo que `AMBIENTES_FOTOS` del backend). */
export const AMBIENTES = Object.keys(NOMBRES_AMBIENTE);

/** Ambientes que admiten número (dormitorio 1, baño 2...). */
export const AMBIENTES_CON_NUMERO = ["dormitorio", "bano"];

/** Etiqueta legible de una sección ("Dormitorio 2", "Living"). */
export function etiquetaSeccion(
  ambiente?: string | null,
  numero?: number | null,
): string | null {
  if (!ambiente) return null;
  const nombre = NOMBRES_AMBIENTE[ambiente] ?? ambiente;
  return numero != null && numero >= 1 ? `${nombre} ${numero}` : nombre;
}

/** Etiquetas legibles de una foto etiquetada (1 o 2). */
export function etiquetasFoto(foto: string | FotoPublicacion): string[] {
  if (!esEtiquetada(foto)) return [];
  const etiquetas = [
    etiquetaSeccion(foto.ambiente, foto.numero),
    etiquetaSeccion(foto.ambiente2, foto.numero2),
  ].filter((e): e is string => e !== null);
  return etiquetas;
}

/** Clave de sección para conteos: "dormitorio|1", "living|". */
export function claveSeccion(ambiente?: string | null, numero?: number | null): string {
  return `${ambiente ?? "otros"}|${numero ?? ""}`;
}

/** Claves de las secciones que cubre una foto (1 o 2). */
export function clavesSeccionFoto(foto: string | FotoPublicacion): string[] {
  if (!esEtiquetada(foto)) return [claveSeccion("otros", null)];
  const claves = [claveSeccion(foto.ambiente, foto.numero)];
  if (foto.ambiente2) claves.push(claveSeccion(foto.ambiente2, foto.numero2));
  return claves;
}

function numeroEntero(valor: string): number | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 ? numero : null;
}

/**
 * ¿La selección excede el tope de 2 fotos por sección?
 *
 * Cuenta las fotos ya cargadas (solo las etiquetadas) más las de esta tandada,
 * en orden. Devuelve la etiqueta legible de la primera sección que excede o
 * null si todo entra.
 */
export function seccionQueExcedeTope(
  fotosExistentes: (string | FotoPublicacion)[],
  entradas: { ambiente: string; numero: string; ambiente2: string; numero2: string }[],
  tope = 2,
): string | null {
  const conteo = new Map<string, number>();
  for (const foto of fotosExistentes) {
    if (!esEtiquetada(foto)) continue;
    for (const clave of clavesSeccionFoto(foto)) {
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
  }
  for (const entrada of entradas) {
    const yaContadas = new Set<string>();
    const secciones: [string, number | null][] = [
      [entrada.ambiente, numeroEntero(entrada.numero)],
      [entrada.ambiente2, numeroEntero(entrada.numero2)],
    ];
    for (const [ambiente, numero] of secciones) {
      if (!ambiente) continue;
      const clave = claveSeccion(ambiente, numero);
      if (yaContadas.has(clave)) continue;
      yaContadas.add(clave);
      const nuevo = (conteo.get(clave) ?? 0) + 1;
      conteo.set(clave, nuevo);
      if (nuevo > tope) return etiquetaSeccion(ambiente, numero) ?? ambiente;
    }
  }
  return null;
}
