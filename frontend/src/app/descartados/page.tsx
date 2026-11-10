/**
 * Zona de descartados: los inmuebles que el inquilino marcó "no me gusta".
 *
 * El backend los excluye de `/recommend`; acá se listan y se puede revertir el
 * descarte (el BFF llama a `DELETE /feedback/{id}`), que es lo que devuelve el
 * inmueble al ranking.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { miFeedback } from "@/lib/api";
import { Pagina } from "@/ui/pagina";
import { Cargando } from "@/ui/cargando";
import { accionRevertir } from "./acciones";

async function Descartes() {
  const descartados = await miFeedback("no_me_gusta");

  if (descartados.length === 0) {
    return <p>No descartaste ningún inmueble todavía.</p>;
  }

  return (
    <ul className="grid gap-4">
      {descartados.map((entrada) => (
        <li key={entrada.id}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>
                {entrada.inmueble?.tipologia ?? "Inmueble"} #{entrada.id_inmueble}
              </CardTitle>
              <form action={accionRevertir.bind(null, entrada.id_inmueble)}>
                <Button type="submit" variant="outline" size="sm">
                  Revertir descarte
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              {entrada.inmueble?.precio != null && (
                <p className="text-sm text-muted-foreground">
                  ${entrada.inmueble.precio.toLocaleString("es-AR")} {entrada.inmueble.moneda}
                </p>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function Descartados() {
  return (
    <Pagina ancho="3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Descartados</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando />}>
            <Descartes />
          </Suspense>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/recomendaciones" className="text-primary hover:underline">
              Volver a recomendaciones
            </Link>
          </p>
        </CardContent>
      </Card>
    </Pagina>
  );
}
