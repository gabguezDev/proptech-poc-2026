/**
 * Página dedicada de una propiedad.
 *
 * Muestra la galería de fotos/videos (almacenadas en SeaweedFS), los datos del
 * inmueble y, si el visitante está logueado como inquilino, el desglose de su
 * Match con esta propiedad.
 */

import Link from "next/link";
import { etiquetasFoto, urlFoto } from "@/lib/fotos";
import type { FotoPublicacion } from "@/lib/tipo";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { miPerfil, miFeedback, obtenerPropiedad, recomendar, usuarioActual } from "@/lib/api";
import { PERFIL_DEMO } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { DesgloseXai } from "@/ui/desglose-xai";
import { BotonDescarte } from "@/ui/boton-descarte";
import { BotonVisita } from "@/ui/boton-visita";
import { BotonFavorito } from "@/ui/boton-favorito";
import { colorMatch } from "@/ui/match-badge";
import { MapaDetalle } from "@/ui/mapa-detalle";
import { BotonesVerificacion } from "@/ui/verificacion";
import { Pagina } from "@/ui/pagina";

const EXPLICACION_DIMENSION: Record<string, string> = {
  Precio:
    "Qué tan lejos está el precio de tu presupuesto máximo. A mayor margen, mejor puntaje.",
  Ubicación:
    "Cercanía al trabajo, a salud (CAPS, hospital, clínica) y, si hacés deporte, a plazas y parques.",
  "Hábitos y confort":
    "Silencio, espacio de home office y lavadero, según los hábitos declarados.",
  Amenities: "Balcón, baños en suite y, si se prefiere cochera, cochera techada.",
  Garantías: "Si las garantías del perfil coinciden con las que acepta el inmueble.",
};

const DIMENSIONES = [
  { clave: "score_precio", etiqueta: "Precio" },
  { clave: "score_ubicacion", etiqueta: "Ubicación" },
  { clave: "score_habitos_confort", etiqueta: "Hábitos y confort" },
  { clave: "score_amenities", etiqueta: "Amenities" },
  { clave: "score_garantias", etiqueta: "Garantías" },
] as const;

/** Grupos de proximidad: para no abrumar, cada grupo se muestra con su menor distancia. */
const GRUPOS_PROXIMIDAD = [
  { clave: "comercio_diario", etiqueta: "Quiosco / Autoservicio", miembros: ["distancia_quiosco_m", "distancia_autoservicio_m"] },
  { clave: "compras", etiqueta: "Supermercado / Hipermercado", miembros: ["distancia_supermercado_m", "distancia_hipermercado_m"] },
  { clave: "verde", etiqueta: "Plaza / Parque", miembros: ["distancia_plaza_m", "distancia_parque_m"] },
  { clave: "educacion_basica", etiqueta: "Escuela / Colegio", miembros: ["distancia_escuela_m", "distancia_colegio_m"] },
  { clave: "educacion_superior", etiqueta: "Instituto terciario / Universidad", miembros: ["distancia_instituto_terciario_m", "distancia_universidad_m"] },
  { clave: "salud", etiqueta: "CAPS / Hospital / Clínica", miembros: ["distancia_caps_m", "distancia_hospital_m", "distancia_clinica_m"] },
  { clave: "estacionamiento", etiqueta: "Estacionamiento medido", miembros: ["distancia_estacionamiento_m"] },
] as const;

function esVideo(url: string) {
  return /\.(mp4|mov|webm)($|\?)/i.test(url) || url.startsWith("data:video");
}

function Galeria({
  fotos,
  idInmueble,
  esBuscador,
}: {
  fotos: (string | FotoPublicacion)[];
  idInmueble: number;
  esBuscador: boolean;
}) {
  if (!fotos.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Sin fotos todavía
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fotos.map((foto, indice) => {
        const url = urlFoto(foto);
        const etiqueta = etiquetasFoto(foto)[0];
        return (
        <figure key={indice} className="space-y-2">
          {esVideo(url) ? (
            <video
              src={url}
              controls
              className="h-56 w-full rounded-lg border object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async"
              src={url}
              alt={`Foto ${indice + 1} de la propiedad`}
              className="h-56 w-full rounded-lg border object-cover"
            />
          )}
          {etiqueta && (
            <figcaption className="text-xs font-medium text-foreground">{etiqueta}</figcaption>
          )}
          {esBuscador && (
            <figcaption className="text-xs text-muted-foreground">
              ¿Esta foto{etiqueta ? ` (${etiqueta.toLowerCase()})` : ""} corresponde al ambiente descrito (dormitorio, cocina…)?
              <BotonesVerificacion
                idInmueble={idInmueble}
                detalle={`foto:${indice}`}
              />
            </figcaption>
          )}
        </figure>
        );
      })}
    </div>
  );
}

async function Contenido({ idInmueble }: { idInmueble: number }) {
  const [propiedad, usuario] = await Promise.all([
    obtenerPropiedad(idInmueble).catch(() => null),
    usuarioActual(),
  ]);
  if (!propiedad) notFound();

  let match: { score: number; resultado: Awaited<ReturnType<typeof recomendar>>["results"][number] } | null = null;
  let trabajo: { lat: number; lon: number } | null = null;
  let zonaSeleccionada: Parameters<typeof MapaDetalle>[0]["zona"] = null;
  let descartado = false;
  if (usuario?.rol === "seeker") {
    const listaDescarte = await miFeedback("no_me_gusta").catch(() => []);
    descartado = listaDescarte.some((e) => e.id_inmueble === idInmueble);
    const guardado = await miPerfil().catch(() => ({ perfil: null }));
    const perfil = guardado.perfil ?? PERFIL_DEMO;
    trabajo = { lat: perfil.lat_trabajo, lon: perfil.lon_trabajo };
    zonaSeleccionada = {
      zona_tipo: perfil.zona_tipo ?? null,
      zona_lat: perfil.zona_lat ?? null,
      zona_lon: perfil.zona_lon ?? null,
      zona_radio_km: perfil.zona_radio_km ?? null,
      zona_puntos: perfil.zona_puntos ?? null,
    };
    const ranking = await recomendar(perfil, 50).catch(() => null);
    const resultado = ranking?.results.find((r) => r.id_inmueble === idInmueble) ?? null;
    if (resultado) {
      match = { score: resultado.score_compatibilidad, resultado };
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {propiedad.titulo ?? `${propiedad.tipologia ?? "Inmueble"} #${propiedad.id_inmueble}`}
          </h1>
          {propiedad.direccion && (
            <p className="mt-1 text-sm text-muted-foreground">{propiedad.direccion}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {propiedad.estado === "borrador" ? (
            <Badge variant="secondary">Borrador</Badge>
          ) : (
            <Badge>Publicado</Badge>
          )}
          {match && (
            <span
              className={`rounded-md px-2 py-1 text-sm font-bold text-white ${colorMatch(match.score)}`}
            >
              {Math.round(match.score)}% Match
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Galeria
          fotos={propiedad.fotos ?? []}
          idInmueble={idInmueble}
          esBuscador={usuario?.rol === "seeker"}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Ubicación</CardTitle>
        </CardHeader>
        <CardContent>
          <MapaDetalle
            inmueble={{
              lat: propiedad.lat ?? null,
              lon: propiedad.lon ?? null,
              titulo: propiedad.titulo ?? null,
            }}
            trabajo={trabajo}
            zona={zonaSeleccionada}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            🏠 Inmueble · 🔴 Tu punto de trabajo · 🔵 Tu zona de búsqueda.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Entorno y servicios cercanos</CardTitle>
        </CardHeader>
        <CardContent>
          {propiedad.proximidad ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Distancias aproximadas al inmueble (informadas por el
                propietario; un visitante que recorrió la propiedad puede
                verificarlas):
              </p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {GRUPOS_PROXIMIDAD.filter(({ miembros }) =>
                miembros.some((clave) => typeof propiedad.proximidad?.[clave] === "number"),
              ).map(({ clave, etiqueta, miembros }) => {
                const metros = Math.min(
                  ...miembros
                    .map((m) => propiedad.proximidad?.[m] as number)
                    .filter((v) => typeof v === "number"),
                );
                const redondeados = Math.round(metros / 100) * 100;
                return (
                  <li key={clave} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>{etiqueta}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          ≈ {redondeados >= 1000
                            ? `${(redondeados / 1000).toFixed(1)} km`
                            : `${redondeados} m`}
                        </span>
                        <Badge
                          variant={
                            redondeados < 500 ? "default" : redondeados < 1000 ? "secondary" : "destructive"
                          }
                        >
                          {redondeados < 500 ? "Cercano" : redondeados < 1000 ? "Mediano" : "Lejano"}
                        </Badge>
                      </span>
                    </div>
                    {usuario?.rol === "seeker" && (
                      <div className="mt-2">
                        <BotonesVerificacion
                          idInmueble={idInmueble}
                          detalle={clave}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              El propietario todavía no cargó la información del entorno.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Datos de la publicación</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {propiedad.direccion && <li>Dirección: {propiedad.direccion}</li>}
            <li>Precio: <strong>${propiedad.precio?.toLocaleString("es-AR")} {propiedad.moneda}</strong></li>
            <li>Tipología: {propiedad.tipologia ?? "—"}</li>
            <li>Habitaciones: {propiedad.cantidad_habitaciones ?? "—"}</li>
            <li>Baños: {propiedad.cantidad_banos ?? "—"}{propiedad.cantidad_banos_en_suite ? ` (${propiedad.cantidad_banos_en_suite} en suite)` : ""}</li>
            {propiedad.superficie != null && <li>Superficie: {propiedad.superficie} m²</li>}
            {propiedad.piso != null && (
              <li>Piso: {propiedad.piso === 0 ? "Planta baja" : `Piso ${propiedad.piso}`}</li>
            )}
            {propiedad.acceso && (
              <li>Acceso: {propiedad.acceso === "ascensor" ? "Por ascensor" : "Por escalera"}</li>
            )}
            {propiedad.balcon_ubicacion != null && propiedad.balcon_ubicacion !== "no_tiene" && (
              <li>Balcón: {propiedad.balcon_ubicacion}</li>
            )}
            <li>
              Cocina: {propiedad.cocina_separada == null ? "—" : propiedad.cocina_separada ? "Separada" : "Integrada (con comedor o living)"}
            </li>
            <li>
              Comedor: {propiedad.living_separado == null ? "—" : propiedad.living_separado ? "Separado del living" : "Integrado al living"}
            </li>
            <li>
              Lavadero: {propiedad.tiene_lavadero ? "Sí" : "No"}{propiedad.lavadero_separado ? " (separado)" : ""}
            </li>
            {propiedad.tiene_patio != null && (
              <li>Patio: {propiedad.tiene_patio ? `Sí${propiedad.patio_cesped ? " (con césped)" : ""}` : "No"}</li>
            )}
            <li>
              Mascotas: {propiedad.acepta_mascotas ? "Acepta" : "No acepta"}
              {propiedad.acepta_mascotas && propiedad.tamano_maximo_mascota
                ? ` (hasta ${propiedad.tamano_maximo_mascota === "indistinto" ? "cualquier tamaño, con responsable" : propiedad.tamano_maximo_mascota})`
                : ""}
            </li>
            <li>
              Cochera: {propiedad.tiene_cochera ? "Sí" : "No"}
              {propiedad.tiene_cochera && propiedad.cochera_techada ? " (techada)" : ""}
            </li>
            {propiedad.espacio_moto_bicicleta != null && (
              <li>Espacio para moto o bicicleta: {propiedad.espacio_moto_bicicleta ? "Sí" : "No"}</li>
            )}
            {propiedad.ambientes && propiedad.ambientes.length > 0 && (
              <li className="sm:col-span-2">
                Ambientes: {propiedad.ambientes.map((grupo) => (grupo.espacios ?? []).join(" + ")).filter(Boolean).join(" · ")}
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {match && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Tu Match con esta propiedad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              Cada porcentaje indica cuánto cumple esta propiedad en esa
              dimensión según tu perfil, de 0% a 100%. Pasá el mouse por el
              ícono de ayuda para ver qué mide cada una.
            </p>
            <DesgloseXai
              items={DIMENSIONES.map(({ clave, etiqueta }) => ({
                etiqueta,
                valor: (match.resultado[clave] as number) * 100,
                ayuda: EXPLICACION_DIMENSION[etiqueta],
              }))}
            />
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {usuario?.rol === "seeker" && <BotonVisita idInmueble={idInmueble} />}
        {usuario?.rol === "seeker" && (
          <BotonDescarte idInmueble={idInmueble} inicial={descartado} />
        )}
        {match && (
          <BotonFavorito
            idInmueble={idInmueble}
            inicial={match.resultado.feedback.includes("favorito")}
          />
        )}
        <Link href="/recomendaciones">
          <Button variant="outline">Volver al ranking</Button>
        </Link>
        <Link href="/mis-inmuebles">
          <Button variant="ghost">Ver score de carga</Button>
        </Link>
      </div>
    </>
  );
}

export default function DetallePropiedad({
  params,
}: {
  params: Promise<{ idInmueble: string }>;
}) {
  return (
    <Pagina ancho="4xl">
      <Card>
        <CardContent className="pt-6">
          <Suspense fallback={<Cargando etiqueta="Cargando la publicación…" />}>
            <Resolver params={params} />
          </Suspense>
        </CardContent>
      </Card>
    </Pagina>
  );
}

async function Resolver({
  params,
}: {
  params: Promise<{ idInmueble: string }>;
}) {
  const { idInmueble } = await params;
  const id = Number(idInmueble);
  if (!Number.isInteger(id)) notFound();
  return <Contenido idInmueble={id} />;
}
