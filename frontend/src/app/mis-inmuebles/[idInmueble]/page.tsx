/**
 * Completitud de un inmueble propio (`GET /propiedades/{id}/completitud`).
 *
 * El backend responde 403 si el usuario no gestiona ese inmueble, así que el
 * ownership se verifica del lado del servidor, no ocultando el link.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  completitudInmueble,
  listarValidaciones,
  listarVisitas,
  resumenFeedbackInmueble,
  usuarioActual,
} from "@/lib/api";
import { ErrorApi, type Completitud, type Inmueble } from "@/lib/tipo";
import { esEtiquetada, etiquetasFoto, urlFoto } from "@/lib/fotos";
import { Cargando } from "@/ui/cargando";
import { DesgloseXai } from "@/ui/desglose-xai";
import { Pagina } from "@/ui/pagina";
import {
  accionConfirmarVisita,
  accionConfirmarVisitaEmail,
  accionEditar,
  accionEstado,
  accionNotificarVisita,
} from "../acciones";
import { FormularioEditar } from "./formulario-editar";
import { SubirFotos } from "./subir-fotos";
import { FormularioValidar } from "./formulario-validar";

/** Qué incluye cada grupo del score de carga. */
const EXPLICACION_GRUPO: Record<string, string> = {
  precio: "Precio, moneda y si la moneda se puede pactar.",
  ubicacion: "Coordenadas, piso, orientación y proximidad al entorno.",
  fisico: "Tipología, habitaciones, baños, distribución, balcón y home office.",
  servicios: "Mascotas, cochera y expensas.",
  garantias: "Garantías que acepta el inmueble (caución, propietario, título).",
  contrato: "Duración, índice y frecuencia de ajuste del contrato.",
  edificio: "Amenities (edificio o casa): quincho, terraza, pileta, gimnasio, ascensor.",
  pension: "Espacios compartidos de la pensión (baño, cocina, comedor, lavadero).",
  publicacion:
    "Fotos etiquetadas por ambiente (living, cocina, dormitorio 1…) y título del anuncio. Con 6 secciones distintas la cobertura de fotos está completa.",
};

function Detalle({ detalle }: { detalle: Completitud }) {
  const criticos = detalle.faltantes.filter((campo) => campo.critico);

  return (
    <>
      <p>
        Score de carga: <strong>{detalle.score_carga}/100</strong>
        {detalle.score_carga < 40 && (
          <span className="text-amber-700 dark:text-amber-300">
            {" "}— con críticos sin cargar el score se topea en 40 y el inmueble
            pierde posición en el ranking.
          </span>
        )}
      </p>

      {criticos.length > 0 && (
        <section className="mt-4">
          <h2 className="font-semibold">Faltan datos críticos</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {criticos.map((campo) => (
              <li key={campo.campo}>
                <strong>{campo.etiqueta}</strong>{" "}
                <code className="rounded bg-muted px-1">{campo.campo}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h2 className="font-semibold">Completitud por grupo</h2>
        <div className="mt-2">
          <DesgloseXai
            items={Object.entries(detalle.grupos).map(([grupo, valor]) => ({
              etiqueta: grupo,
              valor,
              ayuda: EXPLICACION_GRUPO[grupo] ?? "Porcentaje de campos cargados en este grupo.",
            }))}
          />
        </div>
        {detalle.secciones_fotos != null && detalle.secciones_fotos.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Secciones cubiertas por las fotos: {detalle.secciones_fotos.join(" · ")}
            {" "}(con 6 secciones distintas la cobertura está completa).
          </p>
        )}
      </section>

      {detalle.faltantes.length > 0 && (
        <section className="mt-4">
          <h2 className="font-semibold">Todos los campos a completar</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {detalle.faltantes.map((campo) => (
              <li key={campo.campo}>
                {campo.etiqueta}{" "}
                <code className="rounded bg-muted px-1">{campo.campo}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

async function Contenido({ idInmueble }: { idInmueble: number }) {
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

  let detalle: Completitud;
  let resumen: Awaited<ReturnType<typeof resumenFeedbackInmueble>> | null = null;
  let propiedad: Inmueble | null = null;
  let visitas: Awaited<ReturnType<typeof listarVisitas>> = [];
  let pendientes: { detalle: string; refutaciones: number }[] = [];
  let validaciones: Awaited<ReturnType<typeof listarValidaciones>>["validaciones"] = [];
  try {
    const [d, r, p, v, val] = await Promise.all([
      completitudInmueble(idInmueble),
      resumenFeedbackInmueble(idInmueble).catch(() => null),
      import("@/lib/api").then((m) =>
        m.obtenerPropiedad(idInmueble).catch(() => null),
      ),
      listarVisitas(idInmueble).catch(() => []),
      listarValidaciones(idInmueble).catch(() => ({ pendientes: [], validaciones: [] })),
    ]);
    detalle = d;
    resumen = r;
    propiedad = p;
    visitas = v;
    pendientes = val.pendientes;
    validaciones = val.validaciones;
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) notFound();
    if (error instanceof ErrorApi && error.estado === 403) {
      return (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No gestionás el inmueble #{idInmueble}, así que no podés ver su detalle
          de carga.
        </p>
      );
    }
    throw error;
  }

  const fotos = propiedad?.fotos ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {propiedad?.titulo ?? `Inmueble #${idInmueble}`}
          </h1>
          {propiedad?.direccion && (
            <p className="mt-1 text-sm text-muted-foreground">{propiedad.direccion}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={propiedad?.estado === "borrador" ? "secondary" : propiedad?.estado === "alquilada" || propiedad?.estado === "no_disponible" ? "destructive" : "default"}>
            {propiedad?.estado ?? "publicado"}
          </Badge>
          <span className="rounded-md bg-slate-950 px-2 py-1 text-sm font-bold text-white dark:bg-slate-100 dark:text-slate-950">
            {detalle.score_carga}/100
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Galería</CardTitle>
            </CardHeader>
            <CardContent>
              {fotos.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {fotos.map((foto, indice) => {
                    const url = urlFoto(foto);
                    const etiquetas = etiquetasFoto(foto);
                    const esVideo =
                      /\.(mp4|mov|webm)($|\?)/i.test(url) || url.startsWith("data:video");
                    return (
                      <figure key={indice} className="space-y-1">
                        {esVideo ? (
                          <video src={url} controls className="h-44 w-full rounded-lg border object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" decoding="async" src={url} alt={`Foto ${indice + 1}`} className="h-44 w-full rounded-lg border object-cover" />
                        )}
                        {(etiquetas.length > 0 || (esEtiquetada(foto) && foto.portada)) && (
                          <figcaption className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            {esEtiquetada(foto) && foto.portada && (
                              <Badge className="px-1.5 py-0 text-[10px]">Portada</Badge>
                            )}
                            {etiquetas.map((etiqueta) => (
                              <span key={etiqueta} className="rounded bg-muted px-1.5 py-0.5">
                                {etiqueta}
                              </span>
                            ))}
                          </figcaption>
                        )}
                      </figure>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin fotos todavía.</p>
              )}
              <div className="mt-3">
                <SubirFotos idInmueble={idInmueble} fotosExistentes={fotos} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la publicación (editar)</CardTitle>
            </CardHeader>
            <CardContent>
              {propiedad && (
                <FormularioEditar
                  propiedad={propiedad}
                  accion={accionEditar.bind(null, idInmueble)}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
      <p className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        El <strong>score de carga</strong> mide qué tan completa está la ficha que
        publicaste, de 0 a 100. Se calcula como promedio ponderado de los campos
        cargados (precio, ubicación, datos físicos, servicios, garantías,
        contrato y bloques del edificio o pensión): a mayor carga, mejor
        posición en el ranking. Si falta algún campo crítico (precio, moneda,
        coordenadas, tipología, mascotas), el score no puede superar 40. Además,
        el sistema penaliza el Match de los inquilinos según este score: con
        datos faltantes, tu inmueble baja en las recomendaciones. Completá los
        campos faltantes de abajo para mejorar tu posición.
      </p>
      <section className="mb-4">
        <h2 className="font-semibold">Disponibilidad</h2>
        <p className="text-sm text-muted-foreground">
          El estado actual es <strong>{propiedad?.estado ?? "publicado"}</strong>.
          Las propiedades alquiladas o no disponibles salen del catálogo público.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {propiedad?.estado === "borrador" && (
            <form action={accionEstado.bind(null, idInmueble, "publicado")}>
              <Button type="submit" size="sm">Publicar</Button>
            </form>
          )}
          {propiedad?.estado !== "alquilada" && (
            <form action={accionEstado.bind(null, idInmueble, "alquilada")}>
              <Button type="submit" variant="outline" size="sm">Marcar como alquilada</Button>
            </form>
          )}
          {propiedad?.estado !== "no_disponible" && (
            <form action={accionEstado.bind(null, idInmueble, "no_disponible")}>
              <Button type="submit" variant="outline" size="sm">Marcar como no disponible</Button>
            </form>
          )}
          {(propiedad?.estado === "alquilada" || propiedad?.estado === "no_disponible") && (
            <form action={accionEstado.bind(null, idInmueble, "publicado")}>
              <Button type="submit" variant="outline" size="sm">Volver a publicar</Button>
            </form>
          )}
        </div>
      </section>
      <section className="mb-4">
        <h2 className="font-semibold">Feedback recibido</h2>
        <p className="text-sm text-muted-foreground">
          Tu publicación fue marcada como favorito por{" "}
          <strong>{resumen ? resumen.por_tipo.find((i) => i.tipo === "favorito")?.cantidad ?? 0 : 0} usuarios</strong>
          {" "}(no se muestran quiénes son). Total de interacciones:{" "}
          {resumen?.total ?? 0}.
        </p>
        {resumen &&
          resumen.por_tipo.some((i) => i.tipo.includes("|")) && (
            <>
              <h3 className="mt-3 text-sm font-medium">
                Verificación de afirmaciones por visitantes
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {resumen.por_tipo
                  .filter((i) => i.tipo.includes("|"))
                  .map((i) => {
                    const [tipo, detalle] = i.tipo.split("|");
                    const etiqueta =
                      tipo === "vio" ? "confirmaron" : tipo === "no_vio" ? "refutaron" : "no saben";
                    return (
                      <li key={i.tipo}>
                        <code>{detalle}</code>: {i.cantidad} visitantes {etiqueta}
                      </li>
                    );
                  })}
              </ul>
            </>
          )}
      </section>
      <section className="mb-4">
        <h2 className="font-semibold">Visitas</h2>
        <p className="text-sm text-muted-foreground">
          Confirmá la visita de un inquilino para habilitar que verifique tus
          afirmaciones (vio / no vio / no sé).
        </p>
        <div className="mt-2 grid gap-2">
          <form action={accionConfirmarVisita.bind(null, idInmueble)} className="flex flex-wrap gap-2">
            <Input
              type="email"
              name="usuario_email"
              placeholder="Email del buscador que ya visitó"
              className="max-w-64"
              required
            />
            <Button type="submit" size="sm">
              Confirmar visita
            </Button>
          </form>
          <form action={accionNotificarVisita.bind(null, idInmueble)} className="flex flex-wrap gap-2">
            <Input
              type="email"
              name="usuario_email"
              placeholder="Email del buscador a notificar"
              className="max-w-64"
              required
            />
            <Button type="submit" size="sm" variant="outline">
              Notificar para que confirme
            </Button>
          </form>
        </div>
        {visitas.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {visitas.map((v) => (
              <li
                key={v.usuario_email}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span>
                  <code>{v.usuario_email}</code>:{" "}
                  {v.confirmada ? (
                    <strong>visita confirmada ✓</strong>
                  ) : (
                    <>
                      solicitó una visita (
                      {v.repeticiones}x pedido{v.repeticiones !== 1 ? "s" : ""})
                    </>
                  )}
                </span>
                {!v.confirmada && (
                  <form action={accionConfirmarVisitaEmail.bind(null, idInmueble, v.usuario_email)}>
                    <Button type="submit" size="sm">
                      Confirmar visita
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mb-4">
        <h2 className="font-semibold">Validar afirmaciones refutadas</h2>
        <p className="text-sm text-muted-foreground">
          Visitantes dijeron que no era verdadero lo que publicaste. Subí una
          foto del lugar: se usa su GPS; si no lo tiene, usá la ubicación
          enviada.
        </p>
        {pendientes.length === 0 ? (
          <p className="mt-1 text-sm">No hay afirmaciones pendientes de validar.</p>
        ) : (
          <ul className="mt-2 grid gap-3">
            {pendientes.map((p) => (
              <li key={p.detalle} className="rounded-md border p-3">
                <p className="text-sm">
                  <code>{p.detalle}</code>: {p.refutaciones} visitantes refutaron
                </p>
                <FormularioValidar idInmueble={idInmueble} detalle={p.detalle} />
              </li>
            ))}
          </ul>
        )}
        {validaciones.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-medium">Ya validadas</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {validaciones.map((v) => (
                <li key={v.id}>
                  <code>{v.detalle}</code>: {v.resultado} (medida ≈ {v.distancia_medida} m
                  vs declarada {v.distancia_declarada} m)
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <Detalle detalle={detalle} />
        </div>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/mis-inmuebles" className="font-medium text-primary hover:underline">
          Volver a mis inmuebles
        </Link>
      </p>
    </>
  );
}

export default function DetalleInmueble({
  params,
}: {
  params: Promise<{ idInmueble: string }>;
}) {
  return (
    <Pagina ancho="6xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Score de carga</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Cargando />}>
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
