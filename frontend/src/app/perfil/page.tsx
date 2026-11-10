/**
 * Editar perfil del inquilino.
 *
 * Precarga el último perfil guardado por el backend (o el perfil demo si nunca
 * consultó) y lo guarda consultándolo contra `/recommend`.
 */

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { miPerfil, usuarioActual } from "@/lib/api";
import { esBuscador } from "@/lib/rol";
import { PERFIL_DEMO } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";
import { FormularioPerfil } from "./formulario";

async function Contenido() {
  await connection();
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
  if (!esBuscador(usuario.rol)) {
    return (
      <>
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Tu rol <code>{usuario.rol}</code> no tiene perfil de inquilino.
        </p>
      </>
    );
  }

  const guardado = await miPerfil().catch(() => ({ perfil: null }));
  const inicial = guardado.perfil ?? PERFIL_DEMO;

  return (
    <>
      <h1 className="text-2xl font-extrabold">Mi Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tus preferencias se usan para calcular el ranking. Al guardar, se
        recalculan las recomendaciones.
      </p>
      <div className="mt-4">
        <FormularioPerfil inicial={inicial} />
      </div>
    </>
  );
}

export default function Perfil() {
  return (
    <Pagina ancho="6xl">
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Cargando etiqueta="Cargando tu perfil…" />}>
            <Contenido />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
