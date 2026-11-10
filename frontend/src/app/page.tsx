/**
 * Página de inicio: banner, propiedades aleatorias y accesos según el rol.
 *
 * Con Cache Components, el acceso a datos de request (`cookies`, `fetch`) debe
 * estar dentro de una frontera de `<Suspense>`: así el armazón de la página
 * prerenderiza y el contenido llega streaming.
 *
 * Sin sesión, "Ver Detalles" manda a iniciar sesión o registrarse (con vuelta
 * a la propiedad). Con sesión, hay una sección que invita a ver las
 * recomendaciones según el perfil registrado.
 */

import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  estadoBackend,
  listarPropiedades,
  usuarioActual,
} from "@/lib/api";
import { esAdmin, esBuscador, esGestor } from "@/lib/rol";
import { urlFoto } from "@/lib/fotos";
import type { Inmueble } from "@/lib/tipo";
import { Cargando } from "@/ui/cargando";
import { Pagina } from "@/ui/pagina";

const CANTIDAD_ALEATORIAS = 6;

/** Mezcla Fisher-Yates (se ejecuta en tiempo de request, no en el prerender). */
function mezclar(lista: Inmueble[]): Inmueble[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function PropiedadesAleatorias() {
  const [propiedades, usuario] = await Promise.all([
    listarPropiedades(),
    usuarioActual(),
  ]);
  const elegidas = mezclar(propiedades).slice(0, CANTIDAD_ALEATORIAS);

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Propiedades destacadas</h2>
      {elegidas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay propiedades publicadas.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {elegidas.map((propiedad) => {
            const destino = usuario
              ? `/propiedades/${propiedad.id_inmueble}`
              : `/ingresar?vuelve=${encodeURIComponent(`/propiedades/${propiedad.id_inmueble}`)}`;
            return (
              <li key={propiedad.id_inmueble}>
                <Card className="h-full overflow-hidden">
                  <div className="flex h-36 items-center justify-center overflow-hidden bg-muted">
                    {propiedad.fotos?.length ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async"
                        src={urlFoto(propiedad.fotos[0])}
                        alt={`Foto de ${propiedad.titulo ?? "la propiedad"}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg viewBox="0 0 100 80" className="h-14 w-14 text-muted-foreground" aria-hidden>
                        <path d="M50 10 L90 40 L80 40 L80 70 L20 70 L20 40 L10 40 Z" fill="currentColor" opacity="0.35" />
                      </svg>
                    )}
                  </div>
                  <CardContent className="pt-4">
                    <h3 className="font-bold">
                      {propiedad.titulo ??
                        `${propiedad.tipologia ?? "Inmueble"} #${propiedad.id_inmueble}`}
                    </h3>
                    {propiedad.direccion && (
                      <p className="text-sm text-muted-foreground">{propiedad.direccion}</p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {propiedad.cantidad_habitaciones ?? 0} hab.
                      {propiedad.superficie != null && ` · ${propiedad.superficie} m²`}
                    </p>
                    <p className="mt-1">
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        ${propiedad.precio?.toLocaleString("es-AR")}
                      </span>{" "}
                      <span className="text-sm text-muted-foreground">
                        {propiedad.expensas != null ? "+ expensas / mes" : "/ mes"}
                      </span>
                    </p>
                    <Link
                      href={destino}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                    >
                      Ver Detalles
                    </Link>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function TuEspacio() {
  const usuario = await usuarioActual();

  return (
    <section className="mt-8">
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle>
            {usuario
              ? `Hola, ${usuario.nombre}: mirá tus recomendaciones`
              : "Encontrá tu próximo hogar"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usuario ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {esBuscador(usuario.rol)
                  ? "El sistema calculó un ranking según tu perfil registrado (presupuesto, zona, hábitos y garantías). Entrá a verlo."
                  : esGestor(usuario.rol)
                    ? "Gestioná tus publicaciones y mirá qué tan completas están para matchear mejor."
                    : "Administrá el catálogo, los usuarios y la configuración de la plataforma."}
              </p>
              <div className="flex flex-wrap gap-2">
                {esBuscador(usuario.rol) && (
                  <>
                    <Link href="/recomendaciones">
                      <Button>Ver mis recomendaciones</Button>
                    </Link>
                    <Link href="/perfil">
                      <Button variant="outline">Editar mi perfil</Button>
                    </Link>
                  </>
                )}
                {esGestor(usuario.rol) && (
                  <>
                    <Link href="/mis-inmuebles">
                      <Button>Mis propiedades</Button>
                    </Link>
                    <Link href="/mis-inmuebles/nueva">
                      <Button variant="outline">Cargar propiedad</Button>
                    </Link>
                  </>
                )}
                {esAdmin(usuario.rol) && (
                  <>
                    <Link href="/admin/inmuebles">
                      <Button>Inmuebles y scores</Button>
                    </Link>
                    <Link href="/admin/simulacion">
                      <Button variant="outline">Simular recomendaciones</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Creá tu cuenta y recibí recomendaciones basadas en tus hábitos,
                mascotas y presupuesto.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/registrar">
                  <Button>Registrarse</Button>
                </Link>
                <Link href="/ingresar">
                  <Button variant="outline">Iniciar Sesión</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

async function EstadoStack() {
  const estado = await estadoBackend();
  return (
    <p className="mt-8 text-center text-xs text-muted-foreground">
      {estado ? (
        <>
          Backend operativo · modelo activo: <code>{estado.modelo}</code>
        </>
      ) : (
        <>
          El backend no responde. Levantalo con{" "}
          <code>./scripts/dev.sh</code>
        </>
      )}
    </p>
  );
}

export default function Inicio() {
  return (
    <Pagina ancho="6xl">
      <section className="rounded-2xl bg-slate-950 px-6 py-12 text-white shadow dark:bg-slate-900">
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Encontrá tu próximo hogar,{" "}
          <span className="text-sky-400">ajustado a tu medida</span>
        </h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Recomendaciones inteligentes de alquileres calculadas a partir de tus
          preferencias y estilo de vida: precio, ubicación, hábitos, amenities
          y garantías.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/registrar"
            className="inline-flex h-10 items-center justify-center rounded-md bg-sky-600 px-6 font-medium text-white shadow hover:bg-sky-500"
          >
            Registrarse
          </Link>
          <Link
            href="/ingresar"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-600 bg-transparent px-6 font-medium text-white hover:bg-slate-800"
          >
            Iniciar Sesión
          </Link>
        </div>
      </section>

      <Suspense fallback={<Cargando etiqueta="Cargando tu espacio…" />}>
        <TuEspacio />
      </Suspense>
      <Suspense fallback={<Cargando etiqueta="Eligiendo propiedades…" />}>
        <PropiedadesAleatorias />
      </Suspense>
      <Suspense fallback={null}>
        <EstadoStack />
      </Suspense>
    </Pagina>
  );
}
