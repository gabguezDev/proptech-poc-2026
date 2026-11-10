/**
 * Formulario de alta de inmueble (lado oferta).
 *
 * Envía el cuerpo al BFF (`POST /api/propiedades`), que lo reenvía al backend;
 * la propiedad se asigna según el rol (dueño o agente). Los campos sin
 * equivalente en el esquema (título, dirección textual, superficie, fotos) no
 * se piden: el score de carga y el ranking usan los campos del esquema.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import dynamic from "next/dynamic";

import { AMBIENTES, AMBIENTES_CON_NUMERO, NOMBRES_AMBIENTE, seccionQueExcedeTope } from "@/lib/fotos";
import {
  AMBIENTES_POR_DEFECTO,
  EditorAmbientes,
  type AmbienteCrudo,
} from "@/ui/editor-ambientes";

const MapaTrabajo = dynamic(() => import("@/ui/mapa-trabajo").then((m) => m.MapaTrabajo), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" />,
});

const CENTRO = { lat: -27.469, lon: -58.83 };

const MAX_FOTOS = 15;

/** Grupos de entorno del alta: una distancia por grupo (se expande a la clave). */
const GRUPOS_ALTA = [
  { clave: "comercio_diario", etiqueta: "Quiosco / Autoservicio", miembros: ["distancia_quiosco_m", "distancia_autoservicio_m"] },
  { clave: "compras", etiqueta: "Supermercado / Hipermercado", miembros: ["distancia_supermercado_m", "distancia_hipermercado_m"] },
  { clave: "verde", etiqueta: "Plaza / Parque", miembros: ["distancia_plaza_m", "distancia_parque_m"] },
  { clave: "educacion_basica", etiqueta: "Escuela / Colegio", miembros: ["distancia_escuela_m", "distancia_colegio_m"] },
  { clave: "educacion_superior", etiqueta: "Instituto terciario / Universidad", miembros: ["distancia_instituto_terciario_m", "distancia_universidad_m"] },
  { clave: "salud", etiqueta: "CAPS / Hospital / Clínica", miembros: ["distancia_caps_m", "distancia_hospital_m", "distancia_clinica_m"] },
  { clave: "estacionamiento", etiqueta: "Estacionamiento medido", miembros: ["distancia_estacionamiento_m"] },
] as const;

/** Bandas de distancia del entorno: el alta elige el rango y el backend
 * clasifica en cercano (<500 m), mediano (500–999 m) o lejano (≥1000 m). */
const BANDAS_DISTANCIA: Record<string, number> = {
  cerca: 300,
  media: 750,
  lejos: 1500,
};

/** Una foto seleccionada, con su propia etiqueta de ambiente. */
interface EntradaFoto {
  archivo: File;
  ambiente: string;
  numero: string;
  ambiente2: string;
  numero2: string;
}

export function FormularioAlta() {
  const router = useRouter();
  const [punto, setPunto] = useState(CENTRO);
  const [entradas, setEntradas] = useState<EntradaFoto[]>([]);
  const [ambientes, setAmbientes] = useState<AmbienteCrudo[]>(AMBIENTES_POR_DEFECTO);
  const [tienePatio, setTienePatio] = useState(false);
  const [tipologia, setTipologia] = useState("departamento");
  const [estado, setEstado] = useState<"borrador" | "publicado">("publicado");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const seccionExcedida = seccionQueExcedeTope([], entradas);

  function leerFotos(lista: FileList | null) {
    if (!lista?.length) return;
    const nuevas = Array.from(lista).map((archivo) => ({
      archivo,
      ambiente: "",
      numero: "",
      ambiente2: "",
      numero2: "",
    }));
    setEntradas((actual) => [...actual, ...nuevas].slice(0, MAX_FOTOS));
  }

  function actualizarEntrada(indice: number, cambios: Partial<EntradaFoto>) {
    setEntradas((actual) =>
      actual.map((entrada, i) => (i === indice ? { ...entrada, ...cambios } : entrada)),
    );
  }

  function eliminarEntrada(indice: number) {
    setEntradas((actual) => actual.filter((_, i) => i !== indice));
  }

  const [aceptaMascotas, setAceptaMascotas] = useState(true);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const datos = new FormData(evento.currentTarget);
    const texto = (clave: string) => String(datos.get(clave) ?? "").trim();
    const numero = (clave: string, defecto: number) => {
      const valor = Number(datos.get(clave));
      return Number.isFinite(valor) && String(datos.get(clave)) !== "" ? valor : defecto;
    };

    const cuerpo: Record<string, unknown> = {
      titulo: texto("titulo") || null,
      direccion: texto("direccion") || null,
      superficie: texto("superficie") ? numero("superficie", 0) : null,
      estado,
      fotos: [],
      precio: numero("precio", 0),
      moneda: texto("moneda") || "ARS",
      moneda_a_convenir: datos.get("moneda_convenir") === "on",
      tipologia: tipologia || "departamento",
      es_monoambiente: tipologia === "monoambiente",
      cantidad_habitaciones: ambientes.filter((a) => a.espacios.includes("dormitorio")).length,
      cantidad_banos: ambientes.filter((a) => a.espacios.includes("bano")).length,
      cantidad_banos_en_suite: ambientes.filter(
        (a) => a.espacios.includes("bano") && a.espacios.includes("dormitorio"),
      ).length,
      piso: numero("piso", 0),
      acceso: texto("acceso") || "escalera",
      orientacion: texto("orientacion") || "frente",
      tipo_unidad: texto("tipo_unidad") || "edificio",
      cocina_separada: ambientes.some(
        (grupo) => grupo.espacios.includes("cocina") && grupo.espacios.length === 1,
      ),
      living_separado: ambientes.some(
        (grupo) => grupo.espacios.includes("comedor") && !grupo.espacios.includes("living"),
      ),
      tiene_lavadero: ambientes.some((grupo) => grupo.espacios.includes("lavadero")),
      lavadero_separado: ambientes.some(
        (grupo) => grupo.espacios.includes("lavadero") && grupo.separado,
      ),
      tiene_patio: tienePatio,
      patio_cesped: tienePatio ? datos.get("patio_cesped") === "on" : false,
      ambientes: ambientes.length > 0 ? ambientes : null,
      balcon_ubicacion: texto("balcon") || "no_tiene",
      acepta_mascotas: datos.get("mascotas") === "on",
      tamano_maximo_mascota: texto("tamano_mascota") || null,
      tiene_cochera: datos.get("cochera") === "on",
      cochera_techada: datos.get("cochera_techada") === "on",
      espacio_moto_bicicleta: datos.get("espacio_moto_bicicleta") === "on",
      lat: punto.lat,
      lon: punto.lon,
    };

    const proximidad: Record<string, number> = {};
    for (const grupo of GRUPOS_ALTA) {
      const banda = String(datos.get(`prox-${grupo.clave}`) ?? "");
      const valor = BANDAS_DISTANCIA[banda];
      if (valor !== undefined) {
        for (const miembro of grupo.miembros) {
          proximidad[miembro] = valor;
        }
      }
    }
    if (Object.keys(proximidad).length > 0) {
      cuerpo.proximidad = proximidad;
    }

    const expensas = numero("expensas", 0);
    if (expensas > 0) {
      cuerpo.expensas = {
        promedio_ultimos_3_meses: expensas,
        incluye: {
          agua_potable: datos.get("exp-agua") === "on",
          gas: datos.get("exp-gas") === "on",
          energia_electrica_espacios_comunes: datos.get("exp-luz-comun") === "on",
          energia_electrica_departamento: datos.get("exp-luz-depto") === "on",
          limpieza_espacios_comunes: datos.get("exp-limpieza") === "on",
          guardia_camaras: datos.get("exp-guardia") === "on",
          mano_obra_mantenimiento: datos.get("exp-mantenimiento") === "on",
          mantenimiento_ascensor: datos.get("exp-ascensor") === "on",
          otros: [],
        },
      };
    }

    const tipoUnidad = texto("tipo_unidad");
    const conAscensorInferido = tipoUnidad === "edificio" || tipoUnidad === "complejo";
    cuerpo.edificio = {
      tiene_ascensor: conAscensorInferido || datos.get("ed-ascensor") === "on",
      tiene_quincho: datos.get("ed-quincho") === "on",
      quincho_ubicacion: datos.get("ed-quincho") === "on" ? "terraza" : null,
      tiene_terraza: datos.get("ed-terraza") === "on",
      terraza_incluida_expensas: datos.get("ed-terraza") === "on",
      tiene_gimnasio: datos.get("ed-gimnasio") === "on",
      tiene_piscina: datos.get("ed-piscina") === "on",
      otros_amenities: [],
    };

    cuerpo.contrato = {
      duracion_meses: texto("duracion") ? numero("duracion", 0) : null,
      duracion_a_convenir: texto("duracion") === "",
      frecuencia_aumento_meses: numero("frecuencia", 6),
      indice_ajuste: texto("indice") || "ICL",
      frecuencia_aumento_a_convenir: false,
    };

    if (tipologia === "pension") {
      cuerpo.pension = {
        bano_compartido: datos.get("pension_bano") === "on",
        cocina_compartida: datos.get("pension_cocina") === "on",
        comedor_compartido: datos.get("pension_comedor") === "on",
        lavadero_compartido: datos.get("pension_lavadero") === "on",
        otros_espacios_compartidos: [],
      };
    }

    cuerpo.garantias = {
      seguro_caucion: datos.get("gar-caucion") === "on",
      garantia_a_propietario: datos.get("gar-propietario") === "on",
      garantia_a_propietario_reembolsable: datos.get("gar-propietario") === "on" ? true : null,
      titulo_propiedad: datos.get("gar-titulo") === "on",
    };

    try {
      const respuesta = await fetch("/api/propiedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const creado = await respuesta.json();
      if (!respuesta.ok) {
        setError(creado.error ?? "No se pudo publicar la propiedad.");
        return;
      }
      for (const entrada of entradas) {
        const cuerpo = new FormData();
        cuerpo.append("archivos", entrada.archivo);
        if (entrada.ambiente) cuerpo.append("ambiente", entrada.ambiente);
        if (entrada.ambiente2) cuerpo.append("ambiente2", entrada.ambiente2);
        if (entrada.numero) cuerpo.append("numero", entrada.numero);
        if (entrada.numero2) cuerpo.append("numero2", entrada.numero2);
        const subida = await fetch(`/api/propiedades/${creado.id_inmueble}/fotos`, {
          method: "POST",
          body: cuerpo,
        });
        if (!subida.ok) {
          const detalle = await subida.json().catch(() => ({}));
          setError(
            detalle.error ??
              `La propiedad se creó (#${creado.id_inmueble}) pero no se pudieron subir las fotos.`,
          );
          router.push("/mis-inmuebles");
          router.refresh();
          return;
        }
      }
      router.push(`/propiedades/${creado.id_inmueble}`);
      router.refresh();
    } catch {
      setError("No se pudo comunicar con el backend.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Información General</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título del Anuncio</Label>
            <Input id="titulo" name="titulo" placeholder="Depto con balcón y espacio luminoso en Palermo" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="direccion">Dirección Completa (Calle, Número, Barrio)</Label>
            <Input id="direccion" name="direccion" placeholder="Av. Santa Fe 3200, Palermo, CABA" />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tipologia">Tipo de Inmueble</Label>
            <select
              id="tipologia"
              name="tipologia"
              value={tipologia}
              onChange={(e) => setTipologia(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="departamento">Departamento</option>
              <option value="monoambiente">Monoambiente</option>
              <option value="casa">Casa</option>
              <option value="pension">Pensión</option>
            </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="superficie">Superficie Total (m²)</Label>
              <Input id="superficie" name="superficie" type="number" min={0} placeholder="52 m²" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Ubicación y Valores</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="precio">Precio Alquiler ($/mes)</Label>
            <Input id="precio" name="precio" type="number" min={1} required placeholder="$ 420.000" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="moneda">Moneda</Label>
            <select
              id="moneda"
              name="moneda"
              defaultValue="ARS"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="expensas">Expensas ($/mes, opcional)</Label>
            <Input id="expensas" name="expensas" type="number" min={0} placeholder="$ 50.000" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="piso">Piso (0 = planta baja)</Label>
            <Input id="piso" name="piso" type="number" min={0} defaultValue={0} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acceso">Acceso</Label>
            <select id="acceso" name="acceso" defaultValue="escalera"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm">
              <option value="escalera">Por escalera</option>
              <option value="ascensor">Por ascensor</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="orientacion">Orientación</Label>
            <select id="orientacion" name="orientacion" defaultValue="frente"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm">
              <option value="frente">Frente (a la calle)</option>
              <option value="contrafrente">Contrafrente</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tipo-unidad">Tipo de unidad</Label>
            <select id="tipo-unidad" name="tipo_unidad" defaultValue="edificio"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm">
              <option value="edificio">En edificio (bloque)</option>
              <option value="complejo">Complejo / barrio cerrado</option>
              <option value="casa">Casa independiente</option>
              <option value="ph">Planta baja / propiedad horizontal</option>
              <option value="interno">Interno (sin frente propio)</option>
            </select>
          </div>
        </CardContent>
        <CardContent>
          <p className="mb-2 text-xs font-medium">¿Qué incluyen las expensas?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["exp-agua", "Agua potable"],
                ["exp-gas", "Gas"],
                ["exp-luz-comun", "Energía eléctrica espacios comunes"],
                ["exp-luz-depto", "Energía eléctrica"],
                ["exp-limpieza", "Limpieza espacios comunes"],
                ["exp-guardia", "Guardia / Cámaras de seguridad"],
                ["exp-mantenimiento", "Mano de obra de arreglos cotidianos"],
                ["exp-ascensor", "Mantenimiento ascensor"],
              ] as const
            ).map(([name, etiqueta]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} /> {etiqueta}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2b. Amenities, garantías y contrato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <span className="text-sm font-medium">Amenities (edificio, complejo o casa)</span>
            <span />
            {(
              [
                ["ed-ascensor", "Ascensor"],
                ["ed-quincho", "Quincho"],
                ["ed-terraza", "Terraza"],
                ["ed-gimnasio", "Gimnasio"],
                ["ed-piscina", "Piscina"],
              ] as const
            ).map(([name, etiqueta]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} /> {etiqueta}
              </label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <span className="text-sm font-medium">Garantías aceptadas</span>
            <span />
            {(
              [
                ["gar-caucion", "Seguro de caución"],
                ["gar-propietario", "Garantía a propietario"],
                ["gar-titulo", "Título de propiedad"],
              ] as const
            ).map(([name, etiqueta]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} /> {etiqueta}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="duracion">Duración (meses, vacío = a convenir)</Label>
              <Input id="duracion" name="duracion" type="number" min={1} placeholder="24" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="frecuencia">Aumento cada (meses)</Label>
              <Input id="frecuencia" name="frecuencia" type="number" min={1} defaultValue={6} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="indice">Índice de ajuste</Label>
              <select id="indice" name="indice" defaultValue="ICL"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm">
                <option value="ICL">ICL</option>
                <option value="IPC">IPC</option>
                <option value="propietario">Propietario</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Entorno (aproximado)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Elegí el rango de distancia aproximado al grupo (se aplica a cada
            punto del grupo). Ya no necesitás el valor exacto en metros.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {GRUPOS_ALTA.map((grupo) => (
              <div key={grupo.clave} className="grid gap-1.5">
                <Label htmlFor={`prox-${grupo.clave}`}>{grupo.etiqueta}</Label>
                <select
                  id={`prox-${grupo.clave}`}
                  name={`prox-${grupo.clave}`}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                >
                  <option value="">Sin datos</option>
                  <option value="cerca">A menos de 500 m</option>
                  <option value="media">Entre 500 m y 1 km</option>
                  <option value="lejos">Más de 1 km</option>
                </select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">5. Distribución e Infraestructura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Elegí las combinaciones del inmueble (living comedor, cocina
            comedor, suite…) y la cantidad de dormitorios y baños.
          </p>
          <div className="grid gap-4">
            <div className="sm:col-span-2">
              <EditorAmbientes value={ambientes} onCambiar={setAmbientes} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tienePatio}
                onChange={(e) => setTienePatio(e.target.checked)}
              />
              Tiene patio
            </label>
            {tienePatio && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="patio_cesped" />
                Patio con césped
              </label>
            )}
            {tipologia === "pension" && (
              <div className="grid gap-2 rounded-md border p-3 sm:col-span-2">
                <span className="text-sm font-medium">Pensión: espacios compartidos</span>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="pension_bano" defaultChecked /> Baño compartido
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="pension_cocina" defaultChecked /> Cocina compartida
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="pension_comedor" defaultChecked /> Comedor compartido
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="pension_lavadero" defaultChecked /> Lavadero compartido
                </label>
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="cochera" /> Cochera incluida
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="cochera_techada" /> Cochera techada
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="espacio_moto_bicicleta" /> Espacio para moto o bicicleta
            </label>
          <div className="grid gap-1.5">
            <Label htmlFor="balcon">Balcón</Label>
            <select
              id="balcon"
              name="balcon"
              defaultValue="frente"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              <option value="frente">Frente</option>
              <option value="contrafrente">Contrafrente</option>
              <option value="ambos">Ambos</option>
              <option value="no_tiene">Sin balcón</option>
            </select>
          </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">6. Reglas de Convivencia y Políticas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="mascotas"
                checked={aceptaMascotas}
                onChange={(e) => setAceptaMascotas(e.target.checked)}
              />
              Acepta Mascotas (Pet Friendly)
            </label>
            {aceptaMascotas && (
              <div className="grid gap-1.5">
                <Label htmlFor="tamano-mascota">Tamaño máximo aceptado</Label>
                <select
                  id="tamano-mascota"
                  name="tamano_mascota"
                  className="h-9 w-72 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                >
                  <option value="">Sin declarar</option>
                  <option value="chico">Pequeño</option>
                  <option value="mediano">Mediano</option>
                  <option value="grande">Grande</option>
                  <option value="indistinto">Indistinto (con inquilino responsable)</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="moneda_convenir" /> Moneda a convenir
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">7. Ubicación en el mapa</CardTitle>
        </CardHeader>
        <CardContent>
          <MapaTrabajo lat={punto.lat} lon={punto.lon} onCambiar={(lat, lon) => setPunto({ lat, lon })} />
          <p className="mt-2 text-xs text-muted-foreground">
            Coordenadas: {punto.lat.toFixed(5)}, {punto.lon.toFixed(5)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">8. Galería de Fotos y Planos</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
            <span>🖼️ Arrastrá aquí las imágenes de la propiedad o hacé clic para examinar archivos (máx. {MAX_FOTOS} fotos)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => leerFotos(e.target.files)}
            />
          </label>
          {entradas.length > 0 && (
            <div className="mt-3 grid gap-3">
              {entradas.map((entrada, indice) => {
                const esVideo = entrada.archivo.type.startsWith("video/");
                return (
                  <div key={`${entrada.archivo.name}-${indice}`} className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
                    {esVideo ? (
                      <video src={URL.createObjectURL(entrada.archivo)} className="h-16 w-16 rounded-md border object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img loading="lazy" decoding="async" src={URL.createObjectURL(entrada.archivo)} alt={`Foto ${indice + 1}`} className="h-16 w-16 rounded-md border object-cover" />
                    )}
                    <div className="grid min-w-0 flex-1 gap-2">
                      <p className="truncate text-xs text-muted-foreground">{entrada.archivo.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <select
                          aria-label={`Ambiente de la foto ${indice + 1}`}
                          value={entrada.ambiente}
                          onChange={(e) => actualizarEntrada(indice, { ambiente: e.target.value, numero: "" })}
                          className="h-8 max-w-44 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Sin etiqueta</option>
                          {AMBIENTES.map((clave) => (
                            <option key={clave} value={clave}>{NOMBRES_AMBIENTE[clave]}</option>
                          ))}
                        </select>
                        {AMBIENTES_CON_NUMERO.includes(entrada.ambiente) && (
                          <Input
                            aria-label={`N.º de ambiente de la foto ${indice + 1}`}
                            type="number"
                            min={1}
                            required
                            placeholder="N.º"
                            value={entrada.numero}
                            onChange={(e) => actualizarEntrada(indice, { numero: e.target.value })}
                            className="h-8 w-20"
                          />
                        )}
                        <select
                          aria-label={`Segunda etiqueta de la foto ${indice + 1}`}
                          value={entrada.ambiente2}
                          disabled={!entrada.ambiente}
                          onChange={(e) => actualizarEntrada(indice, { ambiente2: e.target.value, numero2: "" })}
                          className="h-8 max-w-44 flex-1 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                        >
                          <option value="">Segunda: ninguna</option>
                          {AMBIENTES.filter((clave) => clave !== entrada.ambiente).map((clave) => (
                            <option key={clave} value={clave}>{NOMBRES_AMBIENTE[clave]}</option>
                          ))}
                        </select>
                        {AMBIENTES_CON_NUMERO.includes(entrada.ambiente2) && (
                          <Input
                            aria-label={`N.º de la segunda etiqueta de la foto ${indice + 1}`}
                            type="number"
                            min={1}
                            required
                            placeholder="N.º"
                            value={entrada.numero2}
                            onChange={(e) => actualizarEntrada(indice, { numero2: e.target.value })}
                            className="h-8 w-20"
                          />
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => eliminarEntrada(indice)} aria-label={`Quitar foto ${indice + 1}`}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Etiquetá cada foto con el ambiente que muestra (sin etiqueta si no corresponde). Cada sección admite hasta 2 fotos; la cobertura mejora el score de carga.
          </p>
          {seccionExcedida && (
            <p className="mt-2 text-sm text-destructive">
              La sección {seccionExcedida} ya tiene 2 fotos (máximo 2).
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          variant="outline"
          disabled={enviando || seccionExcedida !== null}
          onClick={() => setEstado("borrador")}
        >
          {enviando && estado === "borrador" ? "Guardando…" : "Guardar Borrador"}
        </Button>
        <Button
          type="submit"
          disabled={enviando || seccionExcedida !== null}
          onClick={() => setEstado("publicado")}
        >
          {enviando && estado === "publicado" ? "Publicando…" : "Publicar e Iniciar Match"}
        </Button>
      </div>
    </form>
  );
}
