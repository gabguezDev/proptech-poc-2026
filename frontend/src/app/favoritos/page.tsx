/**
 * Favoritos guardados del inquilino.
 *
 * Lista los inmuebles marcados como favoritos, avisa si ya no están
 * disponibles (alquilados o no disponibles) y permite quitarlos.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { miFeedback } from "@/lib/api";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";
import { accionQuitarFavorito } from "./acciones";

async function ListaFavoritos() {
  const favoritos = await miFeedback("favorito");

  if (favoritos.length === 0) {
    return (
      <p>
        Todavía no guardaste favoritos.{" "}
        <Link href="/recomendaciones" className="text-primary hover:underline">
          Ver tus recomendaciones
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="grid gap-4">
      {favoritos.map((entrada) => {
        const inmueble = entrada.inmueble;
        const disponible =
          inmueble?.estado != null && inmueble.estado !== "publicado"
            ? false
            : true;
        return (
          <li key={entrada.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>
                  {inmueble?.titulo ??
                    `${inmueble?.tipologia ?? "Inmueble"} #${entrada.id_inmueble}`}
                </CardTitle>
                {disponible ? (
                  <Badge>Disponible</Badge>
                ) : (
                  <Badge variant="destructive">Ya no disponible</Badge>
                )}
              </CardHeader>
              <CardContent>
                {inmueble?.direccion && (
                  <p className="text-sm text-muted-foreground">{inmueble.direccion}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  ${inmueble?.precio?.toLocaleString("es-AR")} {inmueble?.moneda}
                  {inmueble?.expensas != null ? " + expensas" : ""}
                </p>
                {!disponible && (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Esta propiedad ya no está disponible para alquilar (fue
                    alquilada o retirada). Podés quitarla de tus favoritos.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/propiedades/${entrada.id_inmueble}`}>
                    <Button variant="outline" size="sm">Ver detalle</Button>
                  </Link>
                  <form action={accionQuitarFavorito.bind(null, entrada.id_inmueble)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Quitar de favoritos
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default function PaginaFavoritos() {
  return (
    <Pagina ancho="3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Mis favoritos guardados</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando etiqueta="Cargando tus favoritos…" />}>
            <ListaFavoritos />
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
