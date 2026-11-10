/**
 * `POST /api/propiedades/[idInmueble]/fotos` — proxy multipart del BFF.
 *
 * Reenvía los archivos tal cual al backend (que los guarda en MinIO) con la
 * credencial de la cookie. El navegador nunca ve el token.
 */

import { subirFotos } from "@/lib/api";
import { errorDeValidacion, responder } from "@/lib/respuesta";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ idInmueble: string }> },
) {
  const { idInmueble: crudo } = await params;
  const idInmueble = Number(crudo);
  if (!Number.isInteger(idInmueble)) {
    return errorDeValidacion("Identificador de inmueble inválido.");
  }
  let archivos: File[];
  let ambiente: string | null = null;
  let numero: number | null = null;
  let ambiente2: string | null = null;
  let numero2: number | null = null;
  try {
    const cuerpo = await request.formData();
    archivos = cuerpo.getAll("archivos").filter((item): item is File => item instanceof File);
    ambiente = cuerpo.get("ambiente")?.toString() || null;
    numero = Number(cuerpo.get("numero") ?? "") || null;
    ambiente2 = cuerpo.get("ambiente2")?.toString() || null;
    numero2 = Number(cuerpo.get("numero2") ?? "") || null;
  } catch {
    return errorDeValidacion("Cuerpo multipart inválido.");
  }
  if (!archivos.length) {
    return errorDeValidacion("No se enviaron archivos.");
  }
  return responder(
    subirFotos(idInmueble, archivos, {
      ambiente: ambiente ?? undefined,
      numero: numero ?? undefined,
      ambiente2: ambiente2 ?? undefined,
      numero2: numero2 ?? undefined,
    }),
  );
}
