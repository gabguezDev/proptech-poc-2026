/** Página de acceso: entra o crea una cuenta de inquilino. */

import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usuarioActual } from "@/lib/api";
import { rutaInicio } from "@/lib/rol";
import { Cargando } from "@/ui/cargando";
import { BarraSuperior } from "@/ui/barra-superior";
import { PanelAuth } from "@/ui/auth-marco";
import { accionAccesoRapido } from "./acciones";
import FormularioAcceso from "./formulario";

/** Lee `searchParams` y la sesión: datos de request, van en streaming. */
async function Acceso({
  vuelve,
}: {
  vuelve: Promise<{ vuelve?: string }>;
}) {
  const { vuelve: destino } = await vuelve;
  const alTerminar =
    destino && destino.startsWith("/") ? destino : "";

  const usuario = await usuarioActual();
  if (usuario) {
    return (
      <>
        <p>
          Ya tenés sesión como <strong>{usuario.nombre}</strong>. Ir a{" "}
          <Link href={rutaInicio(usuario.rol)} className="text-primary hover:underline">
            {rutaInicio(usuario.rol)}
          </Link>
          .
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          ¿Querés otra cuenta?{" "}
          <Link href="/registrar" className="text-primary hover:underline">
            Registrate
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <FormularioAcceso vuelve={alTerminar} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/registrar" className="font-bold text-primary hover:underline">
          Registrarse
        </Link>
      </p>
      <div className="mt-6 border-t pt-4">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Acceso rápido (demo) — sin contraseña
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["seeker", "Inquilino"],
              ["prop_owner", "Propietario"],
              ["real_estate_agent", "Agente"],
            ] as const
          ).map(([rol, etiqueta]) => (
            <form key={rol} action={accionAccesoRapido.bind(null, rol, alTerminar)}>
              <Button type="submit" variant="outline" className="w-full">
                {etiqueta}
              </Button>
            </form>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ vuelve?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BarraSuperior usuario={null} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-stretch gap-6 px-6 py-10 md:grid-cols-2">
        <PanelAuth subtitulo="Accedé a tus recomendaciones personalizadas y guardá tus propiedades favoritas." />
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Cargando />}>
              <Acceso vuelve={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
