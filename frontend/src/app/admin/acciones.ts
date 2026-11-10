/**
 * Acciones de servidor de la administración de usuarios.
 *
 * Cada una llama al backend (que vuelve a verificar que el usuario sea `admin`)
 * y, si falla, redirige a la lista con el motivo en `?error=`. Así no hace falta
 * JavaScript en el navegador para cambiar un rol, bloquear o eliminar.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { bloquearUsuario, cambiarRolUsuario, eliminarUsuario } from "@/lib/api";
import { ErrorApi, type Rol } from "@/lib/tipo";

const RUTA = "/admin/usuarios";

/** Vuelve a la lista mostrando el error del backend (o de conexión). */
function volverConError(error: unknown): never {
  const mensaje =
    error instanceof ErrorApi ? error.message : "No se pudo comunicar con el backend.";
  redirect(`${RUTA}?error=${encodeURIComponent(mensaje)}`);
}

function idDelFormulario(formData: FormData): number {
  return Number(formData.get("id"));
}

export async function accionCambiarRol(formData: FormData): Promise<void> {
  try {
    await cambiarRolUsuario(idDelFormulario(formData), String(formData.get("rol")) as Rol);
  } catch (error) {
    volverConError(error);
  }
  revalidatePath(RUTA);
}

export async function accionBloquear(formData: FormData): Promise<void> {
  const bloqueado = formData.get("bloqueado") === "true";
  try {
    await bloquearUsuario(idDelFormulario(formData), bloqueado);
  } catch (error) {
    volverConError(error);
  }
  revalidatePath(RUTA);
}

export async function accionEliminar(formData: FormData): Promise<void> {
  try {
    await eliminarUsuario(idDelFormulario(formData));
  } catch (error) {
    volverConError(error);
  }
  revalidatePath(RUTA);
}
