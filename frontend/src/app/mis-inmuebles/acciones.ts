/**
 * Acciones de servidor del lado oferta.
 *
 * Publican un borrador llamando al BFF, que reenvía el cambio al backend.
 * `revalidatePath` refresca el listado sin recarga manual.
 */

"use server";

import { revalidatePath } from "next/cache";

import { actualizarPropiedad, confirmarVisita, notificarVisita } from "@/lib/api";
import { ErrorApi } from "@/lib/tipo";

export async function accionPublicar(idInmueble: number): Promise<void> {
  await accionEstado(idInmueble, "publicado");
}

/** Cambia el estado de publicación: borrador / publicado / alquilada / no disponible. */export async function accionEstado(
  idInmueble: number,
  estado: "borrador" | "publicado" | "alquilada" | "no_disponible",
): Promise<void> {
  try {
    await actualizarPropiedad(idInmueble, { estado });
  } catch (error) {
    if (error instanceof ErrorApi) return;
    throw error;
  }
  revalidatePath("/mis-inmuebles");
  revalidatePath("/panel");
}

/** Confirma la visita de un inquilino (habilita que verifique afirmaciones). */
export async function accionConfirmarVisita(
  idInmueble: number,
  formData: FormData,
): Promise<void> {
  const email = String(formData.get("usuario_email") ?? "").trim();
  if (!email) return;
  try {
    await confirmarVisita(idInmueble, email);
  } catch (error) {
    if (error instanceof ErrorApi) return;
    throw error;
  }
  revalidatePath("/mis-inmuebles");
}

/** Confirma la visita de un solicitante concreto (desde la lista). */
export async function accionConfirmarVisitaEmail(
  idInmueble: number,
  email: string,
): Promise<void> {
  try {
    await confirmarVisita(idInmueble, email);
  } catch (error) {
    if (error instanceof ErrorApi) return;
    throw error;
  }
  revalidatePath("/mis-inmuebles");
}

/** Edición parcial de los datos de la propiedad (título, precio, etc.). */
export async function accionEditar(
  idInmueble: number,
  formData: FormData,
): Promise<void> {
  const numero = (clave: string) => {
    const valor = Number(formData.get(clave));
    return Number.isFinite(valor) && String(formData.get(clave)).trim() !== ""
      ? valor
      : undefined;
  };
  const cambios: Record<string, unknown> = {};
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (titulo) cambios.titulo = titulo;
  const direccion = String(formData.get("direccion") ?? "").trim();
  if (direccion) cambios.direccion = direccion;
  const precio = numero("precio");
  if (precio != null) cambios.precio = precio;
  const superficie = numero("superficie");
  if (superficie != null) cambios.superficie = superficie;
  const habitaciones = numero("cantidad_habitaciones");
  if (habitaciones != null) cambios.cantidad_habitaciones = habitaciones;
  const banos = numero("cantidad_banos");
  if (banos != null) cambios.cantidad_banos = banos;
  const tipologia = String(formData.get("tipologia") ?? "").trim();
  if (tipologia) cambios.tipologia = tipologia;
  const moneda = String(formData.get("moneda") ?? "").trim();
  if (moneda) cambios.moneda = moneda;
  cambios.acepta_mascotas = formData.get("acepta_mascotas") === "on";
  cambios.tiene_cochera = formData.get("tiene_cochera") === "on";

  try {
    await actualizarPropiedad(idInmueble, cambios);
  } catch (error) {
    if (error instanceof ErrorApi) return;
    throw error;
  }
  revalidatePath("/mis-inmuebles");
}

/** Notifica a un buscador para que confirme su visita. */
export async function accionNotificarVisita(
  idInmueble: number,
  formData: FormData,
): Promise<void> {
  const email = String(formData.get("usuario_email") ?? "").trim();
  if (!email) return;
  try {
    await notificarVisita(idInmueble, email);
  } catch (error) {
    if (error instanceof ErrorApi) return;
    throw error;
  }
  revalidatePath("/mis-inmuebles");
}
