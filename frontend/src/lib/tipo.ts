/**
 * Tipos del dominio, alineados con los esquemas Pydantic del backend
 * (`backend/main.py`). Se mantienen en un solo archivo para que el contrato
 * entre frontend y API se revise en un único lugar.
 */

/** Roles de la plataforma (el `visitor` no tiene cuenta). */
export type Rol =
  | "admin"
  | "prop_owner"
  | "real_estate_agent"
  | "seeker"
  | "visitor";

/** Usuario autenticado, en su vista pública. */
/** Usuario en la vista de administración: incluye si la cuenta está bloqueada. */
export interface UsuarioAdmin extends Usuario {
  bloqueado: boolean;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
}

/** Respuesta de registro/login. El token NO llega al navegador: lo consume el BFF. */
export interface Credenciales {
  access_token: string;
  token_type: string;
  rol: Rol;
  email: string;
  nombre: string;
}

/** Ponderación de las cinco dimensiones del score. */
export interface PesosUsuario {
  precio: number;
  ubicacion: number;
  habitos_confort: number;
  amenities: number;
  garantias: number;
}

/** Perfil del inquilino: `UserPreferences` en el backend. */
export interface PreferenciasUsuario {
  id_inquilino?: number;
  presupuesto_max?: number;
  presupuesto_max_usd?: number | null;
  moneda_preferida?: string;
  tiene_garantia_recibo?: boolean;
  tiene_garantia_prop?: boolean;
  multiplo_sueldo?: number;
  tipologia_preferida?: string;
  cant_dormitorios_min?: number;
  cant_banos_min?: number;
  tiene_mascota?: boolean;
  tipo_mascota?: string | null;
  tamano_mascota?: string | null;
  requiere_cochera?: boolean;
  prefiere_cochera?: boolean;
  requiere_balcon?: boolean;
  requiere_amoblado?: boolean;
  requiere_cocina_separada?: boolean;
  requiere_living_separado?: boolean;
  requiere_lavadero?: boolean;
  preferencia_alquiler?: string | null;
  superficie_min?: number | null;
  expensas_max?: number | null;
  duracion_min?: number | null;
  requiere_quincho?: boolean;
  requiere_terraza?: boolean;
  requiere_piscina?: boolean;
  requiere_ascensor?: boolean;
  planta_baja_deseada?: boolean;
  hace_home_office?: boolean;
  nivel_tolerancia_ruido?: string;
  frecuencia_cocina?: string;
  frecuencia_lavado?: string;
  hace_deporte?: boolean;
  tiene_hijos?: boolean;
  medio_transporte_principal?: string;
  /** Obligatorios: definen el centro de la búsqueda. */
  lat_trabajo: number;
  lon_trabajo: number;
  distancia_max_trabajo_km?: number;
  pesos_usuario?: Partial<PesosUsuario>;
  /** Zona de búsqueda: punto+radio o polígono de 5 vértices (opcional). */
  zona_tipo?: "radio" | "poligono" | null;
  zona_lat?: number | null;
  zona_lon?: number | null;
  zona_radio_km?: number | null;
  zona_puntos?: { lat: number; lon: number }[] | null;
}

/** Bloques anidados del inmueble (viajan como objetos JSON). */
export type Anidado = Record<string, unknown> | null;

/** Inmueble del catálogo público. */
/** Foto de la galería etiquetada por ambiente (ver `lib/fotos.ts`). */
export interface FotoPublicacion {
  url: string;
  ambiente?: string;
  numero?: number | null;
  ambiente2?: string | null;
  numero2?: number | null;
  orden?: number;
  portada?: boolean;
}

export interface Inmueble {
  id_inmueble: number;
  tipologia?: string | null;
  es_monoambiente?: boolean | null;
  cantidad_habitaciones?: number | null;
  cantidad_banos?: number | null;
  cantidad_banos_en_suite?: number | null;
  cocina_separada?: boolean | null;
  living_separado?: boolean | null;
  tiene_lavadero?: boolean | null;
  lavadero_separado?: boolean | null;
  balcon_ubicacion?: string | null;
  piso?: number | null;
  acceso?: string | null;
  orientacion?: string | null;
  tipo_unidad?: string | null;
  lat?: number | null;
  lon?: number | null;
  precio?: number | null;
  moneda?: string | null;
  moneda_a_convenir?: boolean | null;
  acepta_mascotas?: boolean | null;
  tamano_maximo_mascota?: string | null;
  tiene_cochera?: boolean | null;
  cochera_techada?: boolean | null;
  espacio_moto_bicicleta?: boolean | null;
  score_carga?: number | null;
  titulo?: string | null;
  direccion?: string | null;
  superficie?: number | null;
  estado?: string | null;
  fotos?: (string | FotoPublicacion)[];
  ambientes?: { espacios?: string[]; separado?: boolean; numero?: number | null }[] | null;
  expensas?: Anidado;
  edificio?: Anidado;
  proximidad?: Anidado;
  contrato?: Anidado;
  garantias?: Anidado;
  pension?: Anidado;
  [clave: string]: unknown;
}

/** Inmueble recomendado: el público más las features y los sub-scores (XAI). */
export interface Recomendacion extends Inmueble {
  distancia_trabajo: number;
  margen_presupuesto: number;
  match_cochera: number;
  tiene_balcon: number;
  es_silencioso: number;
  proximidad_salud: number;
  proximidad_verde: number;
  match_garantia: number;
  zona_match: number;
  preferencia_match: number;
  score_precio: number;
  score_ubicacion: number;
  score_habitos_confort: number;
  score_amenities: number;
  score_garantias: number;
  score_compatibilidad: number;
  factor_completitud: number;
  feedback: string[];
}

/** Respuesta de `/recommend`. */
export interface RecomendacionRespuesta {
  count: number;
  results: Recomendacion[];
}

/** Tipos de feedback del inquilino. */
export type TipoFeedback =
  | "favorito"
  | "me_gusta"
  | "no_me_gusta"
  | "visto"
  | "contacto"
  | "visita_solicitada"
  | "vio"
  | "no_vio"
  | "no_se"
  | "visita_confirmada";

/** Los mismos valores que valida `backend/src/feedback_tipos.py`. */
export const TIPOS_FEEDBACK: TipoFeedback[] = [
  "favorito",
  "me_gusta",
  "no_me_gusta",
  "visto",
  "contacto",
  "visita_solicitada",
  "vio",
  "no_vio",
  "no_se",
  "visita_confirmada",
];

/** Etiqueta legible de cada tipo, para la interfaz. */
export const ETIQUETA_FEEDBACK: Record<TipoFeedback, string> = {
  favorito: "Favorito",
  me_gusta: "Me gusta",
  no_me_gusta: "No me gusta",
  visto: "Visto",
  contacto: "Contacto",
  visita_solicitada: "Visita solicitada",
  vio: "Confirmó",
  no_vio: "Refutó",
  no_se: "No sabe",
  visita_confirmada: "Visita confirmada",
};

/** Entrada de feedback, con el resumen del inmueble referenciado. */
export interface ItemFeedback {
  id: number;
  usuario_email?: string;
  id_inmueble: number;
  tipo: TipoFeedback;
  detalle?: string | null;
  repeticiones: number;
  creado: number;
  actualizado: number;
  inmueble?: Inmueble;
}

/** Inmueble visto por quien lo gestiona: agrega el ownership. */
export interface InmuebleGestionado extends Inmueble {
  propietario_email: string | null;
  agente_email: string | null;
}

/** Campo faltante en la carga de un inmueble. */
export interface CampoFaltante {
  campo: string;
  etiqueta: string;
  critico: boolean;
}

/** Score de carga de un inmueble (`GET /propiedades/{id}/completitud`). */
export interface Completitud {
  id_inmueble: number;
  score_carga: number;
  grupos: Record<string, number>;
  faltantes: CampoFaltante[];
  secciones_fotos?: string[];
}

/** Error de la API, con el status HTTP y el `detail` de FastAPI. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

/** Perfil demo del inquilino sembrado en el backend (`buscador@proptech.local`). */
export const PERFIL_DEMO: PreferenciasUsuario = {
  presupuesto_max: 250000,
  moneda_preferida: "ARS",
  tiene_garantia_recibo: true,
  tiene_mascota: true,
  tipo_mascota: "perro",
  prefiere_cochera: true,
  hace_home_office: true,
  nivel_tolerancia_ruido: "bajo",
  frecuencia_lavado: "media",
  hace_deporte: true,
  medio_transporte_principal: "auto",
  lat_trabajo: -27.469,
  lon_trabajo: -58.83,
  distancia_max_trabajo_km: 5,
};
