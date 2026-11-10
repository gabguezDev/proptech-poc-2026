/**
 * Acciones de servidor de la zona de descartados.
 *
 * Revirten el "no me gusta" llamando al BFF, que borra el feedback en el
 * backend. `revalidatePath` refresca la lista sin recarga manual.
 */

"use server";

import { revalidatePath } from "next/cache";

import { revertirFeedback } from "@/lib/api";
import { ErrorApi } from "@/lib/tipo";

export async function accionRevertir(idInmueble: number): Promise<void> {
  try {
    await revertirFeedback(idInmueble, "no_me_gusta");
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) return;
    throw error;
  }
  revalidatePath("/descartados");
}
