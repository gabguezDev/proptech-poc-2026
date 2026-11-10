/**
 * Administración de usuarios de la plataforma (solo `admin`).
 *
 * Lista las cuentas con su rol y su estado, y permite cambiar el rol, bloquear o
 * desbloquear y eliminar. El backend impide que el admin se bloquee, se elimine
 * o se cambie el rol a sí mismo; acá además se ocultan esas acciones.
 */

import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarUsuarios, usuarioActual } from "@/lib/api";
import { esAdmin } from "@/lib/rol";
import type { Rol, UsuarioAdmin } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";
import { accionBloquear, accionCambiarRol, accionEliminar } from "../acciones";
import { BotonEliminar } from "./eliminar";

const ROLES: Rol[] = ["seeker", "prop_owner", "real_estate_agent", "admin"];

const ETIQUETA_ROL: Record<Rol, string> = {
  seeker: "Inquilino",
  prop_owner: "Propietario",
  real_estate_agent: "Agente",
  admin: "Administrador",
  visitor: "Visitante",
};

function FilaUsuario({
  usuario,
  esElMismo,
}: {
  usuario: UsuarioAdmin;
  esElMismo: boolean;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-3 align-top">
        <strong>{usuario.nombre}</strong>
        <br />
        <span className="text-xs text-muted-foreground">{usuario.email}</span>
      </td>
      <td className="px-3 py-3 align-top">
        {esElMismo ? (
          <code className="rounded bg-muted px-1">{ETIQUETA_ROL[usuario.rol]}</code>
        ) : (
          <form action={accionCambiarRol} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={usuario.id} />
            <select
              name="rol"
              defaultValue={usuario.rol}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            >
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ETIQUETA_ROL[rol]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Cambiar
            </Button>
          </form>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {usuario.bloqueado ? (
          <Badge variant="destructive">Bloqueada</Badge>
        ) : (
          <Badge>Activa</Badge>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        {esElMismo ? (
          <span className="text-xs text-muted-foreground">Tu cuenta</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <form action={accionBloquear}>
              <input type="hidden" name="id" value={usuario.id} />
              <input
                type="hidden"
                name="bloqueado"
                value={usuario.bloqueado ? "false" : "true"}
              />
              <Button type="submit" variant="outline" size="sm">
                {usuario.bloqueado ? "Desbloquear" : "Bloquear"}
              </Button>
            </form>
            <BotonEliminar id={usuario.id} email={usuario.email} accion={accionEliminar} />
          </div>
        )}
      </td>
    </tr>
  );
}

async function Contenido({
  consulta,
}: {
  consulta: Promise<{ error?: string }>;
}) {
  const { error } = await consulta;
  const usuario = await usuarioActual();

  if (!usuario) {
    return <p>Sin sesión activa.</p>;
  }
  if (!esAdmin(usuario.rol)) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Esta sección es solo para administradores. Tu rol <code>{usuario.rol}</code>{" "}
        no tiene acceso.
      </p>
    );
  }

  const usuarios = await listarUsuarios();

  return (
    <>
      {error && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {usuarios.length} cuentas registradas.{" "}
        {usuarios.filter((u) => u.bloqueado).length} bloqueadas.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((cuenta) => (
              <FilaUsuario
                key={cuenta.id}
                usuario={cuenta}
                esElMismo={cuenta.id === usuario.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function UsuariosAdmin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Pagina ancho="4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando etiqueta="Cargando usuarios…" />}>
            <Contenido consulta={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
