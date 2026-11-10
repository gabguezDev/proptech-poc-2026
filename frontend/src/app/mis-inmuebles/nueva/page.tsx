/**
 * Cargar nueva propiedad (lado oferta).
 *
 * Formulario por secciones que da de alta un inmueble con
 * `POST /propiedades`: la propiedad se asigna según el rol (dueño o agente).
 */

import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usuarioActual } from "@/lib/api";
import { esGestor } from "@/lib/rol";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";
import { FormularioAlta } from "./formulario";

async function Contenido() {
  const usuario = await usuarioActual();

  if (!usuario) {
    return <p>Sin sesión activa.</p>;
  }
  if (!esGestor(usuario.rol)) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Esta sección es solo para propietarios y agentes. Tu rol{" "}
        <code>{usuario.rol}</code> no tiene acceso.
      </p>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold">Cargar Nueva Propiedad (Alquiler)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Completá los datos del inmueble. El sistema de IA calculará el porcentaje
        de Match con inquilinos compatibles.
      </p>
      <div className="mt-4">
        <FormularioAlta />
      </div>
    </>
  );
}

export default function NuevaPropiedad() {
  return (
    <Pagina ancho="4xl">
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Cargando etiqueta="Verificando tu sesión…" />}>
            <Contenido />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
