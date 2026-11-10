/**
 * Ruteo por perfil de negocio.
 *
 * Cada rol tiene su área: el inquilino pide recomendaciones (`/recommend`), el
 * dueño y el agente gestionan inmuebles (`/mis-inmuebles`) y el administrador
 * supervisa el catálogo y las cuentas (`/admin/*`). Mandar a un rol a una
 * pantalla ajena produce un 403 del backend, así que el destino siempre se
 * decide por rol.
 */

import type { Rol } from "./tipo";

/** Ruta de inicio de cada rol. */
export const RUTA_INICIO: Record<Rol, string> = {
  seeker: "/recomendaciones",
  prop_owner: "/panel",
  real_estate_agent: "/panel",
  admin: "/admin",
  visitor: "/ingresar",
};

/** ¿A dónde va este rol al ingresar? */
export function rutaInicio(rol: Rol | string | undefined): string {
  return RUTA_INICIO[(rol ?? "visitor") as Rol] ?? "/";
}

/** El inquilino es el único que pide recomendaciones. */
export function esBuscador(rol: Rol | string | undefined): boolean {
  return rol === "seeker";
}

/** Dueño o agente: gestiona sus inmuebles. */
export function esGestor(rol: Rol | string | undefined): boolean {
  return rol === "prop_owner" || rol === "real_estate_agent";
}

/** Administrador: supervisa todos los inmuebles y las cuentas. */
export function esAdmin(rol: Rol | string | undefined): boolean {
  return rol === "admin";
}

/**
 * Quién puede llamar a `/recommend`: el inquilino para buscar, y el
 * administrador para simular perfiles diversos y ver qué recomienda el modelo.
 */
export function puedeRecomendar(rol: Rol | string | undefined): boolean {
  return rol === "seeker" || rol === "admin";
}
