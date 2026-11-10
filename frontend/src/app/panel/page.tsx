/**
 * Panel del dueño directo / agente inmobiliario.
 *
 * Resumen de sus publicaciones: cantidad, borradores, score de carga promedio
 * y feedback recibido, con accesos a cargar, completar y ver detalle.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { misInmuebles, resumenFeedbackInmueble, usuarioActual } from "@/lib/api";
import { esGestor } from "@/lib/rol";
import type { InmuebleGestionado } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { EstadoCarga } from "@/ui/estado-carga";
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
  if (!esGestor(usuario.rol)) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Tu rol <code>{usuario.rol}</code> no gestiona publicaciones. Este panel es
        para propietarios y agentes.
      </p>
    );
  }

  const inmuebles = await misInmuebles();
  const borradores = inmuebles.filter((i) => i.estado === "borrador");
  const promedio =
    inmuebles.length > 0
      ? Math.round(
          inmuebles.reduce((suma, i) => suma + (i.score_carga ?? 0), 0) / inmuebles.length,
        )
      : 0;

  let favoritos = 0;
  let vistas = 0;
  await Promise.all(
    inmuebles.map(async (inmueble: InmuebleGestionado) => {
      try {
        const resumen = await resumenFeedbackInmueble(inmueble.id_inmueble);
        for (const item of resumen.por_tipo) {
          if (item.tipo === "favorito") favoritos += item.cantidad;
          if (item.tipo === "visto") vistas += item.cantidad;
        }
      } catch {
      }
    }),
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold">Mi Panel</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tus publicaciones y cómo las ve el sistema.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaResumen titulo="Publicaciones" valor={inmuebles.length} detalle={`${inmuebles.length - borradores.length} publicadas`} />
        <TarjetaResumen titulo="Borradores" valor={borradores.length} detalle="todavía no visibles" />
        <TarjetaResumen titulo="Score de carga promedio" valor={`${promedio}/100`} detalle="completitud de tus fichas" />
        <TarjetaResumen titulo="Favoritos recibidos" valor={favoritos} detalle={`${vistas} vistas`} />
      </div>

      <div className="mt-6 grid gap-3 sm:flex">
        <Link href="/mis-inmuebles/nueva">
          <Button>Cargar nueva propiedad</Button>
        </Link>
        <Link href="/mis-inmuebles">
          <Button variant="outline">Ver todas mis publicaciones</Button>
        </Link>
      </div>

      {borradores.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Borradores pendientes de publicar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {borradores.map((inmueble) => (
                <li key={inmueble.id_inmueble} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <span className="text-sm font-medium">
                    {inmueble.titulo ?? `Inmueble #${inmueble.id_inmueble}`}
                  </span>
                  <Link href={`/mis-inmuebles/${inmueble.id_inmueble}`} className="text-sm text-primary hover:underline">
                    Completar y publicar
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <h2 className="mt-8 text-lg font-bold">Tus publicaciones</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2">
        {inmuebles.map((inmueble) => (
          <li key={inmueble.id_inmueble}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {inmueble.titulo ?? `Inmueble #${inmueble.id_inmueble}`}
                </CardTitle>
                <EstadoCarga score={inmueble.score_carga ?? 0} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {inmueble.estado === "borrador" ? "Borrador" : "Publicado"} ·{" "}
                  {inmueble.cantidad_habitaciones ?? 0} hab.
                  {inmueble.superficie != null && ` · ${inmueble.superficie} m²`}
                </p>
                <Link href={`/mis-inmuebles/${inmueble.id_inmueble}`} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
                  Ver qué falta cargar
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function PanelOferta() {
  return (
    <Pagina ancho="4xl">
      <Suspense fallback={<Cargando etiqueta="Cargando tu panel…" />}>
        <Contenido />
      </Suspense>
    </Pagina>
  );
}
