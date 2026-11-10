/** Crear cuenta de inquilino. */

import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cargando } from "@/ui/cargando";
import { BarraSuperior } from "@/ui/barra-superior";
import { PanelAuth } from "@/ui/auth-marco";
import FormularioAcceso from "../ingresar/formulario";

async function Registro({
  vuelve,
}: {
  vuelve: Promise<{ vuelve?: string }>;
}) {
  const { vuelve: destino } = await vuelve;
  const alTerminar =
    destino && destino.startsWith("/") ? destino : "";

  return (
    <>
      <FormularioAcceso vuelve={alTerminar} modo="registrar" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-bold text-primary hover:underline">
          Iniciar Sesión
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        ¿Publicás inmuebles?{" "}
        <Link href="/registrar/oferta" className="font-bold text-primary hover:underline">
          Registrate como propietario o agente
        </Link>
      </p>
    </>
  );
}

export default function Registrar({
  searchParams,
}: {
  searchParams: Promise<{ vuelve?: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BarraSuperior usuario={null} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-stretch gap-6 px-6 py-10 md:grid-cols-2">
        <PanelAuth subtitulo="Creá tu cuenta y recibí recomendaciones basadas en tus hábitos, mascotas y presupuesto." />
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-2xl">Registrarse</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Cargando />}>
              <Registro vuelve={searchParams} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
