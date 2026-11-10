/**
 * Acciones de servidor del formulario de acceso.
 *
 * Son la otra cara del BFF: corren en el servidor de Next.js, hablan con el
 * backend y fijan/borran la cookie `httpOnly`. El navegador nunca ve el token.
 */

"use server";

import { errorPassword } from "@/lib/password";
import { redirect } from "next/navigation";

import { iniciarSesion, registrarUsuario, cerrarSesion, tokenDesdeCookie } from "@/lib/api";
import { rutaInicio } from "@/lib/rol";
import { fijarSesion, limpiarSesion } from "@/lib/sesion";
import { ErrorApi, type Rol } from "@/lib/tipo";

export interface ResultadoFormulario {
  error?: string;
}

/**
 * Destino tras ingresar: respeta `?vuelve=` (lo pone el proxy al cortocircuitar
 * una ruta privada) y si no, manda a la pantalla del rol. Un `prop_owner` no puede
 * ir a `/recomendaciones`: el backend le respondería 403.
 */
function destino(vuelve: unknown, rol: Rol | string | undefined): string {
  if (typeof vuelve === "string" && vuelve.startsWith("/")) return vuelve;
  return rutaInicio(rol);
}

/** Ingresar con email y contraseña. */
export async function accionIngresar(
  _previo: ResultadoFormulario,
  formData: FormData,
): Promise<ResultadoFormulario> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const recordar = formData.get("recordarme") === "on";

  let rol: Rol;
  try {
    const credenciales = await iniciarSesion(email, password);
    await fijarSesion(credenciales.access_token, recordar);
    rol = credenciales.rol;
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 401) {
      return { error: "Email o contraseña incorrectos." };
    }
    if (error instanceof ErrorApi) {
      return { error: error.message };
    }
    return { error: "No se pudo comunicar con el backend." };
  }

  redirect(destino(formData.get("vuelve"), rol));
}

/** Roles que se pueden elegir al autorregistrarse. El `admin` nunca se ofrece. */
const ROLES_REGISTRO = ["seeker", "prop_owner", "real_estate_agent"];

/** Crear una cuenta (inquilino u oferta) y entrar. */
export async function accionRegistrar(
  _previo: ResultadoFormulario,
  formData: FormData,
): Promise<ResultadoFormulario> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  const nombre = String(formData.get("nombre") ?? "") || undefined;
  const rol = String(formData.get("rol") ?? "seeker");

  const motivoPassword = errorPassword(password);
  if (motivoPassword) {
    return { error: motivoPassword };
  }
  if (confirmar && confirmar !== password) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (!ROLES_REGISTRO.includes(rol)) {
    return { error: "Rol no permitido para el registro." };
  }

  try {
    const credenciales = await registrarUsuario({ email, password, nombre, rol });
    await fijarSesion(credenciales.access_token);
  } catch (error) {
    if (error instanceof ErrorApi) {
      return { error: error.message };
    }
    return { error: "No se pudo comunicar con el backend." };
  }

  redirect(destino(formData.get("vuelve"), rol));
}

/** Cerrar sesión: revoca la credencial en el backend y borra la cookie. */
export async function accionCerrarSesion(): Promise<void> {
  const token = await tokenDesdeCookie();
  try {
    await cerrarSesion(token);
  } catch {
  }
  await limpiarSesion();
  redirect("/ingresar");
}

/**
 * Acceso rápido por rol (cuentas demo): entra sin escribir la contraseña.
 * Las credenciales son las sembradas por el backend al arrancar.
 */
const CUENTAS_DEMO: Record<string, { email: string; password: string }> = {
  seeker: {
    email: process.env.SEEKER_EMAIL ?? "buscador@proptech.local",
    password: process.env.SEEKER_PASSWORD ?? "buscador12345",
  },
  prop_owner: {
    email: process.env.OWNER_EMAIL ?? "dueno@proptech.local",
    password: process.env.OWNER_PASSWORD ?? "dueno12345",
  },
  real_estate_agent: {
    email: process.env.AGENT_EMAIL ?? "agente@proptech.local",
    password: process.env.AGENT_PASSWORD ?? "agente12345",
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? "admin@proptech.local",
    password: process.env.ADMIN_PASSWORD ?? "admin12345",
  },
};

export async function accionAccesoRapido(
  rol: string,
  vuelve: string,
): Promise<void> {
  const cuenta = CUENTAS_DEMO[rol];
  if (!cuenta) redirect("/ingresar");
  const credenciales = await iniciarSesion(cuenta.email, cuenta.password);
  await fijarSesion(credenciales.access_token, true);
  redirect(destino(vuelve, rol));
}
