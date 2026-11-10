/**
 * Ranking de propiedades por afinidad (IA) del inquilino.
 *
 * Server Component dentro de una frontera de `<Suspense>`: el armazón
 * prerenderiza y el ranking (que lee la cookie de sesión y llama al backend)
 * llega en streaming. Cada tarjeta muestra el match, las señales principales
 * (distancia, mascotas, presupuesto) y el desglose por dimensión (XAI).
 *
 * `/recommend` solo admite `seeker` y `admin`: cualquier otro rol ve un aviso y
 * un enlace a su propia pantalla, en vez de un 403 del backend.
 */

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { miPerfil, recomendar, usuarioActual } from "@/lib/api";
import { caracteristicasDe } from "@/lib/caracteristicas";
import { esBuscador, rutaInicio } from "@/lib/rol";
import {
  ETIQUETA_FEEDBACK,
  PERFIL_DEMO,
  type Recomendacion,
  type TipoFeedback,
  type Usuario,
} from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { DesgloseXai } from "@/ui/desglose-xai";
import { GaleriaRanking } from "@/ui/galeria-ranking";
import { colorMatch } from "@/ui/match-badge";
import { BotonFavorito } from "@/ui/boton-favorito";
import { Pagina } from "@/ui/pagina";

/** Dimensiones del score, en el orden del desglose. */
/** Qué mide cada dimensión del Match (se muestra con el ícono de ayuda). */
const EXPLICACION_DIMENSION: Record<string, string> = {
  Precio:
    "Qué tan lejos está el precio de tu presupuesto máximo. A mayor margen, mejor puntaje.",
  Ubicación:
    "Cercanía al trabajo, a salud (CAPS, hospital, clínica) y, si hacés deporte, a plazas y parques.",
  "Hábitos y confort":
    "Silencio, espacio de home office y lavadero, según los hábitos que declaraste en tu perfil.",
  Amenities:
    "Balcón, baños en suite y, si preferís cochera, cochera techada (vale más).",
  Garantías:
    "Si las garantías que podés ofrecer coinciden con las que acepta el inmueble.",
};

const DIMENSIONES: { clave: keyof Recomendacion; etiqueta: string }[] = [
  { clave: "score_precio", etiqueta: "Precio" },
  { clave: "score_ubicacion", etiqueta: "Ubicación" },
  { clave: "score_habitos_confort", etiqueta: "Hábitos y confort" },
  { clave: "score_amenities", etiqueta: "Amenities" },
  { clave: "score_garantias", etiqueta: "Garantías" },
];

function Senal({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
      ) : (
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span>{children}</span>
    </li>
  );
}

function TarjetaRanking({ inmueble }: { inmueble: Recomendacion }) {
  const match = Math.round(inmueble.score_compatibilidad);
  return (
    <li>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex w-full shrink-0 flex-col bg-muted sm:w-80">
            <span
              className={`absolute left-2 top-2 z-10 rounded px-1.5 py-0.5 text-xs font-bold text-white ${colorMatch(match)}`}
            >
              #{match}% Match
            </span>
            <GaleriaRanking
              idInmueble={inmueble.id_inmueble}
              fotos={inmueble.fotos ?? []}
              titulo={inmueble.titulo}
            />
          </div>
          <div className="flex flex-1 flex-col p-5 pl-0 sm:pl-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {inmueble.titulo ?? `${inmueble.tipologia ?? "Inmueble"} #${inmueble.id_inmueble}`}
                </h2>
                {inmueble.direccion && (
                  <p className="text-sm text-muted-foreground">{inmueble.direccion}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {inmueble.cantidad_habitaciones} Dormitorio · {inmueble.cantidad_banos}{" "}
                  Baño{inmueble.superficie != null && ` · ${inmueble.superficie} m²`} ·{" "}
                  {inmueble.tiene_balcon ? "Balcón" : "Sin balcón"}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <p className="text-right">
                  <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                    ${inmueble.precio?.toLocaleString("es-AR")}
                  </span>{" "}
                  <span className="text-sm text-muted-foreground">
                    {inmueble.expensas != null ? "+ expensas / mes" : "/ mes"}
                  </span>
                </p>
                <BotonFavorito
                  idInmueble={inmueble.id_inmueble}
                  inicial={inmueble.feedback.includes("favorito")}
                />
              </div>
            </div>

            <ul className="mt-3 space-y-1.5 text-sm">
              <Senal ok>
                A solo {inmueble.distancia_trabajo.toFixed(1)} km de tu lugar de trabajo
              </Senal>
              {inmueble.acepta_mascotas ? (
                <Senal ok>Acepta mascotas sin restricciones</Senal>
              ) : (
                <Senal ok={false}>No acepta mascotas</Senal>
              )}
              {inmueble.margen_presupuesto >= 0.2 ? (
                <Senal ok>Ajustado a tu presupuesto deseado</Senal>
              ) : (
                <Senal ok={false}>Cerca del límite de tu presupuesto máximo</Senal>
              )}
              {inmueble.zona_match === 1 ? (
                <Senal ok>Dentro de tu zona de búsqueda</Senal>
              ) : (
                <Senal ok={false}>Fuera de tu zona de búsqueda</Senal>
              )}
              {inmueble.preferencia_match === 1 ? (
                <Senal ok>Vía preferida de alquiler</Senal>
              ) : (
                <Senal ok={false}>Vía distinta a tu preferencia</Senal>
              )}
            </ul>

            <details className="group mt-4">
              <summary className="inline-flex h-9 cursor-pointer list-none items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow hover:bg-secondary/80 [&::-webkit-details-marker]:hidden">
                Ver desglose
              </summary>
              <p className="mt-3 max-w-md rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                Cada porcentaje indica cuánto cumple este inmueble en esa
                dimensión según tu perfil, de 0% a 100%. El Match final es el
                promedio ponderado de las cinco dimensiones, con los pesos de
                tu perfil (precio y ubicación pesan más), penalizado si al
                inmueble le faltan datos cargados. Pasá el mouse por el ícono
                de ayuda para ver qué mide cada una.
              </p>
              <div className="mt-3">
                <DesgloseXai
                  items={DIMENSIONES.map(({ clave, etiqueta }) => ({
                    etiqueta,
                    valor: (inmueble[clave] as number) * 100,
                    ayuda: EXPLICACION_DIMENSION[etiqueta],
                  }))}
                />
              </div>
              {inmueble.feedback.length > 0 && (
                <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {inmueble.feedback
                    .map((tipo) => ETIQUETA_FEEDBACK[tipo as TipoFeedback] ?? tipo)
                    .join(" · ")}
                </p>
              )}
            </details>
            <Link
              href={`/propiedades/${inmueble.id_inmueble}`}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Ver Detalles
            </Link>
          </div>
        </div>
      </Card>
    </li>
  );
}

async function Ranking({ perfil, topK }: { perfil: typeof PERFIL_DEMO; topK: number }) {
  const resultado = await recomendar(perfil, topK);

  if (resultado.count === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Ningún inmueble pasó los filtros duros con este perfil (presupuesto,
        mascota, cochera, moneda).
      </p>
    );
  }

  return (
    <>
      <ol className="grid gap-4">
        {resultado.results.map((inmueble) => (
          <TarjetaRanking key={inmueble.id_inmueble} inmueble={inmueble} />
        ))}
      </ol>
      {resultado.count >= topK && topK < 20 && (
        <div className="mt-6 text-center">
          <Link
            href={`?mostrar=${topK + 5}`}
            scroll={false}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Calcular y mostrar más propiedades
          </Link>
        </div>
      )}
    </>
  );
}

function SinPermiso({ usuario }: { usuario: Usuario }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      Tu rol <code>{usuario.rol}</code> no pide recomendaciones. Podés ir a{" "}
      <Link href={rutaInicio(usuario.rol)} className="font-medium underline">
        tu pantalla
      </Link>
      {usuario.rol === "admin" && (
        <>
          {" "}o{" "}
          <Link href="/admin/simulacion" className="font-medium underline">
            simular perfiles
          </Link>
        </>
      )}
      .
    </p>
  );
}

async function Contenido({
  mostrar,
}: {
  mostrar: Promise<{ mostrar?: string }>;
}) {
  await connection();
  const usuario = await usuarioActual();
  const { mostrar: crudo } = await mostrar;
  const topK = Math.min(20, Math.max(5, Number(crudo) || 5));

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
        <SinPermiso usuario={usuario} />
      </>
    );
  }

  const guardado = await miPerfil().catch(() => ({ perfil: null }));
  const perfil = guardado.perfil ?? PERFIL_DEMO;
  const caracteristicas = caracteristicasDe(perfil);

  return (
    <>
      <h1 className="text-2xl font-extrabold">Ranking de Propiedades por Afinidad (IA)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recomendaciones personalizadas calculadas a partir de tus preferencias y
        estilo de vida.
      </p>

      <div className="mt-4 rounded-lg border bg-card p-3 text-sm shadow-sm">
        <p className="font-medium">Este ranking se calculó a partir de:</p>
        <div className="mt-2 overflow-hidden" aria-label="Características del perfil que generaron el ranking">
          <div className="anim-marquesina flex w-max gap-2">
            {[0, 1].map((copia) => (
              <div key={copia} className="flex gap-2" aria-hidden={copia === 1}>
                {caracteristicas.map((c) => (
                  <span
                    key={c.id}
                    className="whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs"
                  >
                    {c.icono} {c.texto}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <Link
          href="/perfil"
          className="mt-2 inline-block rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-950"
        >
          ✎ Editar Perfil
        </Link>
      </div>

      <div className="mt-4">
        <Suspense fallback={<Cargando etiqueta="Calculando compatibilidad…" />}>
          <Ranking perfil={perfil} topK={topK} />
        </Suspense>
      </div>
    </>
  );
}

export default function Recomendaciones({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string }>;
}) {
  return (
    <Pagina ancho="6xl">
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Cargando etiqueta="Verificando tu sesión…" />}>
            <Contenido mostrar={searchParams} />
          </Suspense>
          <p className="mt-4 text-sm text-muted-foreground">
            Ver también:{" "}
            <Link href="/descartados" className="text-primary hover:underline">
              los que descartaste
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </Pagina>
  );
}
