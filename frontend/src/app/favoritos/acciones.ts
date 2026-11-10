/**
 * Acciones de servidor de favoritos: quitar un favorito guardado.
 */

"use server";

import { revalidatePath } from "next/cache";

import { revertirFeedback } from "@/lib/api";
import { ErrorApi } from "@/lib/tipo";

export async function accionQuitarFavorito(idInmueble: number): Promise<void> {
  try {
    await revertirFeedback(idInmueble, "favorito");
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) return;
    throw error;
  }
  revalidatePath("/favoritos");
}
