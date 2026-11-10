/**
 * Mis inmuebles (lado oferta).
 *
 * `GET /mis-inmuebles` devuelve solo los inmuebles que el usuario gestiona: los
 * propios si es `prop_owner`, los de su cartera si es `real_estate_agent`, todos
 * si es `admin`. Cada uno trae el `score_carga`, que es lo que el propietario ve
 * para saber qué le falta cargar a su anuncio.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { misInmuebles, usuarioActual } from "@/lib/api";
import { esGestor } from "@/lib/rol";
import { Cargando } from "@/ui/cargando";
import { EstadoCarga } from "@/ui/estado-carga";
import { Pagina } from "@/ui/pagina";
import { accionPublicar } from "./acciones";

async function Inmuebles() {
  const usuario = await usuarioActual();

  if (!usuario) {
    return (
      <p>
        Sin sesión activa.{" "}
        <Link href="/ingresar" className="text-primary hover:underline">
          Ingresar
        </Link>
        .
      </p>
    );
  }
  if (!esGestor(usuario.rol)) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>{usuario.rol}</strong> no gestiona inmuebles: este listado es del
        lado oferta. Entrá con <code>dueno@proptech.local</code> o{" "}
        <code>agente@proptech.local</code>, o ve a{" "}
        <Link href="/recomendaciones" className="font-medium underline">
          tus recomendaciones
        </Link>
        .
      </p>
    );
  }

  const inmuebles = await misInmuebles();

  if (inmuebles.length === 0) {
    return <p>No gestionás ningún inmueble todavía.</p>;
  }

  return (
    <ul className="grid gap-4">
      {inmuebles.map((inmueble) => (
        <li key={inmueble.id_inmueble}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>
                {inmueble.titulo ?? `${inmueble.tipologia ?? "Inmueble"} #${inmueble.id_inmueble}`}
              </CardTitle>
              <div className="flex items-center gap-2">
                {inmueble.estado === "borrador" ? (
                  <Badge variant="secondary">Borrador</Badge>
                ) : inmueble.estado === "alquilada" ? (
                  <Badge variant="destructive">Alquilada</Badge>
                ) : inmueble.estado === "no_disponible" ? (
                  <Badge variant="outline">No disponible</Badge>
                ) : (
                  <Badge>Publicado</Badge>
                )}
                <EstadoCarga score={inmueble.score_carga ?? 0} />
              </div>
            </CardHeader>
            <CardContent>
              {inmueble.direccion && (
                <p className="text-sm text-muted-foreground">{inmueble.direccion}</p>
              )}
              <p className="text-sm text-muted-foreground">
                ${inmueble.precio?.toLocaleString("es-AR") ?? "—"} {inmueble.moneda ?? ""}
                {" · "}
                {inmueble.cantidad_habitaciones ?? 0} hab.
                {inmueble.superficie != null && ` · ${inmueble.superficie} m²`}
                {" · "}
                {inmueble.acepta_mascotas ? "acepta mascotas" : "sin mascotas"}
                {" · "}
                {inmueble.tiene_cochera ? "con cochera" : "sin cochera"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <Link
                  href={`/mis-inmuebles/${inmueble.id_inmueble}`}
                  className="font-medium text-primary hover:underline"
                >
                  Ver qué falta cargar
                </Link>
                {inmueble.estado === "borrador" && (
                  <form action={accionPublicar.bind(null, inmueble.id_inmueble)}>
                    <Button type="submit" size="sm">
                      Publicar
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function MisInmuebles() {
  return (
    <Pagina ancho="3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Mis inmuebles</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando etiqueta="Leyendo tu cartera…" />}>
            <Inmuebles />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
