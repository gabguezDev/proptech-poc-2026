/**
 * Simulación de recomendaciones (solo `admin`).
 *
 * El administrador puede probar perfiles diversos contra `/recommend` sin crear
 * cuentas de inquilino: el backend admite el rol `admin` en ese endpoint.
 */

import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usuarioActual } from "@/lib/api";
import { esAdmin } from "@/lib/rol";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";
import { FormularioSimulacion } from "./formulario";

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

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Armá un perfil de inquilino y mirá qué recomienda el modelo. El perfil se
        guarda como último perfil consultado de tu cuenta.
      </p>
      <FormularioSimulacion />
    </>
  );
}

export default function SimulacionAdmin() {
  return (
    <Pagina ancho="3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Simular recomendaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando etiqueta="Verificando tu sesión…" />}>
            <Contenido />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}
