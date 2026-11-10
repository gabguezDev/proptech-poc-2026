/**
 * Cliente del BFF hacia el backend FastAPI.
 *
 * TODO este módulo corre en el servidor de Next.js: es el único lugar que ve la
 * credencial opaca. Las páginas (Server Components) y los route handlers la usan,
 * y nunca la reenvían al navegador: la credencial viaja al navegador solo como
 * cookie `httpOnly`.
 */

import { cookies } from "next/headers";

import { BACKEND_URL, COOKIE_SESION } from "./env";
import {
  ErrorApi,
  type Completitud,
  type Credenciales,
  type Inmueble,
  type InmuebleGestionado,
  type ItemFeedback,
  type PreferenciasUsuario,
  type RecomendacionRespuesta,
  type TipoFeedback,
  type Rol,
  type Usuario,
  type UsuarioAdmin,
} from "./tipo";

/** Opciones de una llamada al backend. */
interface Opciones {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  cuerpo?: unknown;
  /** Cadena de consulta; los valores `undefined` se omiten. */
  consulta?: Record<string, string | number | boolean | undefined>;
  /** Credencial opaca. Si no se informa, se intenta leer de la cookie. */
  token?: string | null;
}

/** URL absoluta del backend para una ruta como `/propiedades`. */
export function urlApi(ruta: string, consulta?: Opciones["consulta"]): string {
  const url = new URL(`${BACKEND_URL}${ruta}`);
  if (consulta) {
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined) url.searchParams.set(clave, String(valor));
    }
  }
  return url.toString();
}

/** Lee la credencial de la cookie del request (solo en servidor). */
export async function tokenDesdeCookie(): Promise<string | null> {
  const almacén = await cookies();
  return almacén.get(COOKIE_SESION)?.value ?? null;
}

/** Traduce un error de FastAPI (`{ detail: ... }`) a un mensaje legible. */
async function extraerDetalle(respuesta: Response): Promise<string> {
  const texto = await respuesta.text();
  try {
    const datos = JSON.parse(texto) as { detail?: unknown };
    if (typeof datos.detail === "string") return datos.detail;
    if (Array.isArray(datos.detail)) {
      return datos.detail
        .map((item) => {
          const loc = Array.isArray((item as { loc?: unknown[] }).loc)
            ? (item as { loc: unknown[] }).loc.slice(1).join(".")
            : "";
          const msg = (item as { msg?: string }).msg ?? "dato inválido";
          return loc ? `${loc}: ${msg}` : msg;
        })
        .join(" · ");
    }
    return texto || respuesta.statusText;
  } catch {
    return texto || respuesta.statusText;
  }
}

/** Llama al backend y devuelve el JSON parseado (`null` cuando responde 204). */
export async function llamar<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { metodo = "GET", cuerpo, consulta } = opciones;
  const token =
    opciones.token !== undefined ? opciones.token : await tokenDesdeCookie();

  const cabeceras: Record<string, string> = { Accept: "application/json" };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";

  const respuesta = await fetch(urlApi(ruta, consulta), {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    cache: "no-store",
  });

  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await extraerDetalle(respuesta));
  }
  if (respuesta.status === 204 || respuesta.headers.get("content-length") === "0") {
    return null as T;
  }
  return (await respuesta.json()) as T;
}


export interface EstadoBackend {
  status: string;
  message: string;
  modelo: string;
}

/** `GET /` del backend: salud y modelo activo. `null` si no responde. */
export async function estadoBackend(): Promise<EstadoBackend | null> {
  try {
    return await llamar<EstadoBackend>("/", { token: null });
  } catch {
    return null;
  }
}


/** `POST /auth/login`. Devuelve credenciales; el BFF guarda el token en la cookie. */
export function iniciarSesion(email: string, password: string) {
  return llamar<Credenciales>("/auth/login", {
    metodo: "POST",
    cuerpo: { email, password },
    token: null,
  });
}

/** `POST /auth/registro`. */
export function registrarUsuario(data: {
  email: string;
  password: string;
  nombre?: string;
  rol?: string;
}) {
  return llamar<Credenciales>("/auth/registro", {
    metodo: "POST",
    cuerpo: data,
    token: null,
  });
}

/** `POST /auth/logout`: revoca la credencial del lado del servidor. */
export function cerrarSesion(token: string | null) {
  return llamar<{ status: string }>("/auth/logout", {
    metodo: "POST",
    token,
  });
}

/** `GET /auth/me`: usuario de la credencial, o `null` si no hay sesión válida. */
export async function usuarioActual(): Promise<Usuario | null> {
  try {
    return await llamar<Usuario>("/auth/me");
  } catch (error) {
    if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 403)) {
      return null;
    }
    throw error;
  }
}


/** `POST /recommend?top_k=`: ranking de compatibilidad para un perfil. */
export function recomendar(perfil: PreferenciasUsuario, topK = 5) {
  return llamar<RecomendacionRespuesta>("/recommend", {
    metodo: "POST",
    cuerpo: perfil,
    consulta: { top_k: topK },
  });
}

/** `POST /feedback`: registra favorito / reacción / interacción. */
export function registrarFeedback(
  idInmueble: number,
  tipo: TipoFeedback,
  detalle?: string,
) {
  return llamar<ItemFeedback>("/feedback", {
    metodo: "POST",
    cuerpo: { id_inmueble: idInmueble, tipo, detalle },
  });
}

/** `GET /mis-feedback`: feedback del usuario, con filtro opcional por tipo. */
export function miFeedback(tipo?: TipoFeedback) {
  return llamar<ItemFeedback[]>("/mis-feedback", {
    consulta: { tipo },
  });
}

/** `DELETE /feedback/{id}`: revierte el feedback (todo, o solo un tipo). */
export function revertirFeedback(idInmueble: number, tipo?: TipoFeedback) {
  return llamar<{ status: string; quitados: number }>(
    `/feedback/${idInmueble}`,
    { metodo: "DELETE", consulta: { tipo } },
  );
}


/** `GET /propiedades`: catálogo público con `score_carga`. */
export function listarPropiedades() {
  return llamar<Inmueble[]>("/propiedades", { token: null });
}

/**
 * `GET /mis-inmuebles`: inmuebles que gestiona el usuario (rol oferta) o todos
 * si es `admin`. Requiere `prop_owner` / `real_estate_agent` / `admin`.
 */
export function misInmuebles() {
  return llamar<InmuebleGestionado[]>("/mis-inmuebles");
}

/** `GET /propiedades/{id}/completitud`: score de carga y qué falta cargar. */
export function completitudInmueble(idInmueble: number) {
  return llamar<Completitud>(`/propiedades/${idInmueble}/completitud`);
}

/** `POST /propiedades`: alta de un inmueble (propiedad asignada por rol). */
export function crearPropiedad(datos: Record<string, unknown>) {
  return llamar<InmuebleGestionado>("/propiedades", {
    metodo: "POST",
    cuerpo: datos,
  });
}

/** `GET /feedback/inmueble/{id}`: resumen de feedback recibido (lado oferta). */
export function resumenFeedbackInmueble(idInmueble: number) {
  return llamar<{
    id_inmueble: number;
    total: number;
    por_tipo: { tipo: string; cantidad: number }[];
  }>(`/feedback/inmueble/${idInmueble}`);
}

/** `PUT /propiedades/{id}`: edición parcial (p. ej. publicar un borrador). */
export function actualizarPropiedad(idInmueble: number, datos: Record<string, unknown>) {
  return llamar<InmuebleGestionado>(`/propiedades/${idInmueble}`, {
    metodo: "PUT",
    cuerpo: datos,
  });
}

/** `GET /propiedades/{id}`: detalle (público si está publicado; dueño si es borrador). */
export function obtenerPropiedad(idInmueble: number) {
  return llamar<Inmueble>(`/propiedades/${idInmueble}`);
}

/**
 * `POST /propiedades/{id}/fotos`: sube fotos/videos (multipart) al
 * almacenamiento local. El navegador nunca ve el token: va en el header.
 *
 * La etiqueta (`ambiente` + `numero`, y opcionalmente `ambiente2`/`numero2`)
 * identifica la sección que muestra cada archivo (mismo valor para toda la
 * tandada).
 */
export async function subirFotos(
  idInmueble: number,
  archivos: File[],
  etiqueta?: {
    ambiente?: string;
    numero?: number;
    ambiente2?: string;
    numero2?: number;
  },
) {
  const token = await tokenDesdeCookie();
  const cuerpo = new FormData();
  for (const archivo of archivos) {
    cuerpo.append("archivos", archivo);
  }
  if (etiqueta?.ambiente) cuerpo.append("ambiente", etiqueta.ambiente);
  if (etiqueta?.numero) cuerpo.append("numero", String(etiqueta.numero));
  if (etiqueta?.ambiente2) cuerpo.append("ambiente2", etiqueta.ambiente2);
  if (etiqueta?.numero2) cuerpo.append("numero2", String(etiqueta.numero2));
  const cabeceras: Record<string, string> = {};
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(urlApi(`/propiedades/${idInmueble}/fotos`), {
    method: "POST",
    headers: cabeceras,
    body: cuerpo,
    cache: "no-store",
  });
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await extraerDetalle(respuesta));
  }
  return (await respuesta.json()) as InmuebleGestionado;
}

/** `GET /mi-perfil`: último perfil consultado, o null si nunca consultó. */
export function miPerfil() {
  return llamar<{ perfil: PreferenciasUsuario | null }>("/mi-perfil");
}

/** `POST /propiedades/{id}/visita`: el dueño/agente confirma la visita. */
export function confirmarVisita(idInmueble: number, usuarioEmail: string) {
  return llamar<{ status: string; usuario_email: string }>(
    `/propiedades/${idInmueble}/visita`,
    { metodo: "POST", cuerpo: { usuario_email: usuarioEmail } },
  );
}

/** `POST /propiedades/{id}/visita/notificar`: el dueño pide autoconfirmación. */
export function notificarVisita(idInmueble: number, usuarioEmail: string) {
  return llamar<{ status: string; usuario_email: string; notificado: boolean }>(
    `/propiedades/${idInmueble}/visita/notificar`,
    { metodo: "POST", cuerpo: { usuario_email: usuarioEmail } },
  );
}

/** `GET /propiedades/{id}/visitas`: solicitantes y estado de confirmación. */
export function listarVisitas(idInmueble: number) {
  return llamar<
    { usuario_email: string; confirmada: boolean; repeticiones: number }[]
  >(`/propiedades/${idInmueble}/visitas`);
}

/** `GET /propiedades/{id}/validaciones`: refutaciones y validaciones hechas. */
export function listarValidaciones(idInmueble: number) {
  return llamar<{
    pendientes: { detalle: string; refutaciones: number }[];
    validaciones: {
      id: number;
      detalle: string;
      foto_url: string | null;
      distancia_medida: number | null;
      distancia_declarada: number | null;
      resultado: string;
    }[];
  }>(`/propiedades/${idInmueble}/validaciones`);
}

/** `POST /propiedades/{id}/validar`: valida una afirmación refutada con foto. */
export async function validarAfirmacion(
  idInmueble: number,
  datos: { detalle: string; foto: File; lat?: number; lon?: number },
) {
  const token = await tokenDesdeCookie();
  const cuerpo = new FormData();
  cuerpo.append("detalle", datos.detalle);
  cuerpo.append("foto", datos.foto);
  if (datos.lat != null) cuerpo.append("lat", String(datos.lat));
  if (datos.lon != null) cuerpo.append("lon", String(datos.lon));
  const cabeceras: Record<string, string> = {};
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const respuesta = await fetch(urlApi(`/propiedades/${idInmueble}/validar`), {
    method: "POST",
    headers: cabeceras,
    body: cuerpo,
    cache: "no-store",
  });
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, await extraerDetalle(respuesta));
  }
  return (await respuesta.json()) as {
    detalle: string;
    distancia_medida: number | null;
    distancia_declarada: number | null;
    resultado: string;
  };
}


/** `GET /admin/usuarios`: todas las cuentas, con rol y estado de bloqueo. */
export function listarUsuarios() {
  return llamar<UsuarioAdmin[]>("/admin/usuarios");
}

/** `PUT /admin/usuarios/{id}/rol`: cambia el rol de una cuenta. */
export function cambiarRolUsuario(usuarioId: number, rol: Rol) {
  return llamar<UsuarioAdmin>(`/admin/usuarios/${usuarioId}/rol`, {
    metodo: "PUT",
    cuerpo: { rol },
  });
}

/** `PUT /admin/usuarios/{id}/bloqueo`: bloquea o desbloquea una cuenta. */
export function bloquearUsuario(usuarioId: number, bloqueado: boolean) {
  return llamar<UsuarioAdmin>(`/admin/usuarios/${usuarioId}/bloqueo`, {
    metodo: "PUT",
    cuerpo: { bloqueado },
  });
}

/** `DELETE /admin/usuarios/{id}`: da de baja la cuenta y revoca sus sesiones. */
export function eliminarUsuario(usuarioId: number) {
  return llamar<{ status: string }>(`/admin/usuarios/${usuarioId}`, {
    metodo: "DELETE",
  });
}
