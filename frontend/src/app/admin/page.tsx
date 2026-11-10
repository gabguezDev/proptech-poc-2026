/**
 * Dashboard del administrador.
 *
 * Resumen de la plataforma: catálogo (total, publicados, borradores, score de
 * carga promedio), cuentas por rol y accesos a las secciones de gestión.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listarUsuarios, misInmuebles, usuarioActual } from "@/lib/api";
import { esAdmin } from "@/lib/rol";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";

function TarjetaResumen({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string | number;
  detalle?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-extrabold">{valor}</p>
        {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
      </CardContent>
    </Card>
  );
}

async function Contenido() {
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

  const [catalogo, usuarios] = await Promise.all([misInmuebles(), listarUsuarios()]);
  const publicados = catalogo.filter((i) => i.estado !== "borrador").length;
  const borradores = catalogo.length - publicados;
  const promedio =
    catalogo.length > 0
      ? Math.round(
          catalogo.reduce((suma, i) => suma + (i.score_carga ?? 0), 0) / catalogo.length,
        )
      : 0;
  const porRol = usuarios.reduce<Record<string, number>>((acum, u) => {
    acum[u.rol] = (acum[u.rol] ?? 0) + 1;
    return acum;
  }, {});

  return (
    <>
      <h1 className="text-2xl font-extrabold">Dashboard de administración</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vista general de la plataforma PropTech Match.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaResumen titulo="Inmuebles publicados" valor={publicados} detalle={`de ${catalogo.length} en total`} />
        <TarjetaResumen titulo="Borradores" valor={borradores} detalle="sin publicar todavía" />
        <TarjetaResumen titulo="Score de carga promedio" valor={`${promedio}/100`} detalle="completitud del catálogo" />
        <TarjetaResumen titulo="Usuarios" valor={usuarios.length} detalle={Object.entries(porRol).map(([rol, n]) => `${rol}: ${n}`).join(" · ")} />
      </div>

      <div className="mt-6 grid gap-3 sm:flex">
        <Link href="/admin/inmuebles">
          <Button>Ver inmuebles y scores</Button>
        </Link>
        <Link href="/admin/usuarios">
          <Button variant="outline">Gestionar usuarios</Button>
        </Link>
        <Link href="/admin/simulacion">
          <Button variant="outline">Simular recomendaciones</Button>
        </Link>
      </div>
    </>
  );
}

export default function DashboardAdmin() {
  return (
    <Pagina ancho="4xl">
      <Suspense fallback={<Cargando etiqueta="Cargando el dashboard…" />}>
        <Contenido />
      </Suspense>
    </Pagina>
  );
}
