/**
 * Barra superior única de la aplicación (la misma en todas las páginas).
 *
 * Sin sesión: marca + toggle de tema + píldora a la oferta (pantallas de
 * acceso). Con sesión: marca + enlaces según el rol + usuario + tema +
 * cerrar sesión. La autorización real la verifica el backend en cada request.
 */

import Link from "next/link";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { esAdmin, esBuscador, esGestor } from "@/lib/rol";
import type { Usuario } from "@/lib/tipo";
import { accionCerrarSesion } from "@/app/ingresar/acciones";

export function BarraSuperior({ usuario }: { usuario: Usuario | null }) {
  const enlaces: { href: string; texto: string }[] = [];

  if (usuario) {
    if (esBuscador(usuario.rol)) {
      enlaces.push({ href: "/recomendaciones", texto: "Ranking IA" });
      enlaces.push({ href: "/favoritos", texto: "Favoritos" });
      enlaces.push({ href: "/descartados", texto: "Guardados" });
      enlaces.push({ href: "/perfil", texto: "Mi Perfil" });
    }
    if (esGestor(usuario.rol)) {
      enlaces.push({ href: "/panel", texto: "Panel" });
      enlaces.push({ href: "/mis-inmuebles/nueva", texto: "Cargar Propiedad" });
      enlaces.push({ href: "/mis-inmuebles", texto: "Mis Propiedades" });
    }
    if (esAdmin(usuario.rol)) {
      enlaces.push({ href: "/admin", texto: "Dashboard" });
      enlaces.push({ href: "/admin/inmuebles", texto: "Inmuebles" });
      enlaces.push({ href: "/admin/usuarios", texto: "Usuarios" });
      enlaces.push({ href: "/admin/simulacion", texto: "Simular" });
    }
  }

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-slate-950 px-4 py-2.5 text-white shadow-sm dark:bg-slate-900">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-base font-extrabold text-sky-400">
          PropTech Match
        </Link>
        {enlaces.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {enlaces.map((enlace) => (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className="text-sm text-slate-200 hover:text-white hover:underline"
                >
                  {enlace.texto}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2">
        {usuario ? (
          <>
            <span className="text-xs text-slate-300">
              {usuario.nombre} ·{" "}
              <code className="rounded bg-slate-800 px-1">{usuario.rol}</code>
            </span>
            <ThemeToggle />
            <form action={accionCerrarSesion}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link
              href="/ingresar"
              className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
            >
              🏠 ¿Eres agente inmobiliario o propietario?
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
