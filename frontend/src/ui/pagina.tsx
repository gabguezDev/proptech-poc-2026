/**
 * Páginas de la app con la barra superior a todo ancho.
 *
 * La barra (marca, enlaces por rol, tema, sesión) va fuera del contenedor
 * centrado del contenido, para que ocupe todo el ancho de la página.
 * Resuelve el usuario en streaming dentro de `<Suspense>`.
 */

import { Suspense, type ReactNode } from "react";

import { usuarioActual } from "@/lib/api";
import { BarraSuperior } from "./barra-superior";

async function Barra() {
  const usuario = await usuarioActual();
  return <BarraSuperior usuario={usuario} />;
}

const ANCHOS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
} as const;

export function Pagina({
  children,
  ancho = "3xl",
}: {
  children: ReactNode;
  ancho?: keyof typeof ANCHOS;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={null}>
        <Barra />
      </Suspense>
      <main className={`anim-fade-up mx-auto ${ANCHOS[ancho]} px-5 py-8`}>{children}</main>
    </div>
  );
}
