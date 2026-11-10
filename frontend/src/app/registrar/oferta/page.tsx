/**
 * Registro del lado oferta: propietarios directos y agentes inmobiliarios.
 *
 * Es una página distinta de `/registrar` (inquilinos) para separar los roles.
 * El administrador nunca se ofrece: lo rechaza el backend y la acción local.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cargando } from "@/ui/cargando";
import { BarraSuperior } from "@/ui/barra-superior";
import { PanelAuth } from "@/ui/auth-marco";
import FormularioAcceso from "../../ingresar/formulario";

async function RegistroOferta({
  vuelve,
}: {
  vuelve: Promise<{ vuelve?: string }>;
}) {
  const { vuelve: destino } = await vuelve;
  const alTerminar =
    destino && destino.startsWith("/") ? destino : "";

  return (
    <>
      <FormularioAcceso vuelve={alTerminar} modo="oferta" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-bold text-primary hover:underline">
          Iniciar Sesión
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        ¿Buscás alquilar?{" "}
        <Link href="/registrar" className="font-bold text-primary hover:underline">
          Registrate como inquilino
        </Link>
      </p>
    </>
  );
}

export default function RegistrarOferta({
  searchParams,
}: {
  searchParams: Promise<{ vuelve?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BarraSuperior usuario={null} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-stretch gap-6 px-6 py-10 md:grid-cols-2">
        <PanelAuth subtitulo="Publicá tus inmuebles y completá la ficha: a mayor carga, mayor probabilidad de matchear con inquilinos." />
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">Registrarse (oferta)</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Cargando />}>
              <RegistroOferta vuelve={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
