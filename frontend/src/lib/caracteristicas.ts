/**
 * Características del perfil que explican el ranking (fuente única y escalable).
 *
 * Cada regla describe UNA característica de forma declarativa:
 *  - `id`: identificador estable.
 *  - `icono` / `texto(perfil)`: cómo mostrarla (null si no aplica).
 *
 * Para sumar un parámetro nuevo del perfil (cuando el backend lo exponga) solo
 * hay que agregar una entrada en `REGLAS`, sin tocar la vista. Los factores
 * que no aplican simplemente no aparecen.
 */

import type { PreferenciasUsuario } from "./tipo";

export interface Caracteristica {
  id: string;
  icono: string;
  texto: string;
}

type Regla = {
  id: string;
  icono: string;
  cuando: (perfil: PreferenciasUsuario) => boolean;
  texto: (perfil: PreferenciasUsuario) => string;
};

/**
 * Reglas declarativas por característica. El orden es el orden visual.
 * Agregá una entrada por parámetro nuevo del perfil.
 */
export const REGLAS_CARACTERISTICAS: Regla[] = [
  {
    id: "presupuesto",
    icono: "💰",
    cuando: (p) => p.presupuesto_max != null,
    texto: (p) =>
      `$${p.presupuesto_max?.toLocaleString("es-AR")} ${p.moneda_preferida ?? "ARS"}`,
  },
  {
    id: "distancia_trabajo",
    icono: "📍",
    cuando: (p) => p.distancia_max_trabajo_km != null,
    texto: (p) => `Radio de ${p.distancia_max_trabajo_km} km del trabajo`,
  },
  {
    id: "zona_radio",
    icono: "🔵",
    cuando: (p) => p.zona_tipo === "radio" && p.zona_radio_km != null,
    texto: (p) => `Zona circular de ${p.zona_radio_km} km`,
  },
  {
    id: "zona_poligono",
    icono: "⬠",
    cuando: (p) => p.zona_tipo === "poligono" && p.zona_puntos != null,
    texto: (p) => `Zona poligonal de ${p.zona_puntos?.length ?? 0} puntos`,
  },
  {
    id: "mascota",
    icono: "🐾",
    cuando: (p) => Boolean(p.tiene_mascota),
    texto: (p) => `Con mascota (${p.tipo_mascota ?? "filtro duro"})`,
  },
  {
    id: "cochera",
    icono: "🚗",
    cuando: (p) => Boolean(p.requiere_cochera),
    texto: () => "Cochera obligatoria",
  },
  {
    id: "home_office",
    icono: "🏠",
    cuando: (p) => Boolean(p.hace_home_office),
    texto: () => "Hace home office",
  },
  {
    id: "ruido",
    icono: "🔇",
    cuando: (p) => p.nivel_tolerancia_ruido === "bajo",
    texto: () => "Tolerancia al ruido baja",
  },
  {
    id: "deporte",
    icono: "🏃",
    cuando: (p) => Boolean(p.hace_deporte),
    texto: () => "Hace deporte (cerca de parques)",
  },
  {
    id: "hijos",
    icono: "👨‍👩‍👧",
    cuando: (p) => Boolean(p.tiene_hijos),
    texto: () => "Tiene hijos (valora más dormitorios)",
  },
  {
    id: "garantia_recibo",
    icono: "🧾",
    cuando: (p) => Boolean(p.tiene_garantia_recibo),
    texto: () => "Con recibo de sueldo",
  },
  {
    id: "garantia_prop",
    icono: "🏛️",
    cuando: (p) => Boolean(p.tiene_garantia_prop),
    texto: () => "Con garantía propietaria",
  },
  {
    id: "alquiler",
    icono: "🏢",
    cuando: (p) => p.preferencia_alquiler != null && p.preferencia_alquiler !== "indistinta",
    texto: (p) =>
      p.preferencia_alquiler === "inmobiliaria_primero"
        ? "Preferencia: inmobiliaria primero"
        : "Preferencia: dueño directo primero",
  },
  {
    id: "cocina_separada",
    icono: "🍳",
    cuando: (p) => Boolean(p.requiere_cocina_separada),
    texto: () => "Cocina separada",
  },
  {
    id: "living_separado",
    icono: "🛋️",
    cuando: (p) => Boolean(p.requiere_living_separado),
    texto: () => "Living separado",
  },
  {
    id: "lavadero",
    icono: "🧺",
    cuando: (p) => Boolean(p.requiere_lavadero),
    texto: () => "Lavadero",
  },
  {
    id: "tipologia",
    icono: "🏠",
    cuando: (p) => p.tipologia_preferida != null,
    texto: (p) => `Tipo: ${({ depto: "Departamento", casa: "Casa", monoambiente: "Monoambiente" } as Record<string, string>)[p.tipologia_preferida ?? ""] ?? p.tipologia_preferida}`,
  },
  {
    id: "dormitorios",
    icono: "🛏️",
    cuando: (p) => p.cant_dormitorios_min != null,
    texto: (p) => `${p.cant_dormitorios_min} dormitorio${(p.cant_dormitorios_min ?? 0) === 1 ? "" : "s"} (mín.)`,
  },
  {
    id: "banos",
    icono: "🚿",
    cuando: (p) => p.cant_banos_min != null,
    texto: (p) => `${p.cant_banos_min} baño${(p.cant_banos_min ?? 0) === 1 ? "" : "s"} (mín.)`,
  },
  {
    id: "balcon",
    icono: "🚪",
    cuando: (p) => Boolean(p.requiere_balcon),
    texto: () => "Requiere balcón",
  },
  {
    id: "amoblado",
    icono: "🛋️",
    cuando: (p) => Boolean(p.requiere_amoblado),
    texto: () => "Requiere amoblado",
  },
  {
    id: "superficie",
    icono: "📐",
    cuando: (p) => p.superficie_min != null,
    texto: (p) => `${p.superficie_min} m² mínimo`,
  },
  {
    id: "expensas",
    icono: "🧾",
    cuando: (p) => p.expensas_max != null,
    texto: (p) => `Expensas hasta $${p.expensas_max?.toLocaleString("es-AR")}`,
  },
  {
    id: "amenities",
    icono: "🏊",
    cuando: (p) => Boolean(p.requiere_quincho || p.requiere_terraza || p.requiere_piscina || p.requiere_ascensor),
    texto: () => "Amenities (edificio o casa)",
  },
];

/** Características activas de un perfil, en orden visual. */
export function caracteristicasDe(
  perfil: PreferenciasUsuario,
): Caracteristica[] {
  return REGLAS_CARACTERISTICAS.filter((regla) => regla.cuando(perfil)).map(
    (regla) => ({
      id: regla.id,
      icono: regla.icono,
      texto: regla.texto(perfil),
    }),
  );
}
