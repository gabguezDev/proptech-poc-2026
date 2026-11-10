/**
 * Catálogo completo con el score de carga de cada inmueble (solo `admin`).
 *
 * El score de carga mide qué tan completa está la información cargada por el
 * propietario: a menor score, más penalizado queda el inmueble en el ranking.
 * Se ordena de menor a mayor para que lo más incompleto quede arriba.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { misInmuebles, usuarioActual } from "@/lib/api";
import { esAdmin } from "@/lib/rol";
import type { InmuebleGestionado } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { EstadoCarga } from "@/ui/estado-carga";
import { Pagina } from "@/ui/pagina";

/** Cortes de nivel de carga, igual que el badge de la vista del propietario. */
function nivel(score: number): "ok" | "medio" | "bajo" {
  return score >= 90 ? "ok" : score >= 60 ? "medio" : "bajo";
}

function Resumen({ inmuebles }: { inmuebles: InmuebleGestionado[] }) {
  const conteo = { ok: 0, medio: 0, bajo: 0 };
  for (const inmueble of inmuebles) {
    conteo[nivel(inmueble.score_carga ?? 0)] += 1;
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {inmuebles.length} inmuebles ·{" "}
      <Badge>{conteo.ok} completos</Badge>{" "}
      <Badge variant="secondary">{conteo.medio} parciales</Badge>{" "}
      <Badge variant="destructive">{conteo.bajo} incompletos</Badge>
    </p>
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

  const inmuebles = [...(await misInmuebles())].sort(
    (a, b) => (a.score_carga ?? 0) - (b.score_carga ?? 0),
  );

  return (
    <>
      <Resumen inmuebles={inmuebles} />
      <ul className="mt-4 grid gap-4">
        {inmuebles.map((inmueble) => (
          <li key={inmueble.id_inmueble}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  {inmueble.tipologia ?? "Inmueble"} #{inmueble.id_inmueble}
                </CardTitle>
                <EstadoCarga score={inmueble.score_carga ?? 0} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ${inmueble.precio?.toLocaleString("es-AR") ?? "—"} {inmueble.moneda ?? ""}
                  {" · "}
                  {inmueble.cantidad_habitaciones ?? 0} hab.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Propietario: {inmueble.propietario_email ?? "sin asignar"} · Agente:{" "}
                  {inmueble.agente_email ?? "sin asignar"}
                </p>
                <p className="mt-2 text-sm">
                  <Link
                    href={`/mis-inmuebles/${inmueble.id_inmueble}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Ver qué le falta cargar
                  </Link>
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function InmueblesAdmin() {
  return (
    <Pagina ancho="3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Inmuebles y score de carga</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando etiqueta="Calculando scores…" />}>
            <Contenido />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
