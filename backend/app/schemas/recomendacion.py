"""Esquemas Pydantic del perfil del inquilino y del ranking."""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.inmueble import Inmueble

class PuntoGeo(BaseModel):
  """Coordenada geográfica (vértice de una zona poligonal)."""

  lat: float = Field(..., description="Latitud")
  lon: float = Field(..., description="Longitud")


class PesosUsuario(BaseModel):
  """Pesos personalizados por el usuario. Deben sumar 1.0."""

  precio: float = Field(0.30, ge=0.0, le=1.0, description="Peso de la dimensión precio")
  ubicacion: float = Field(0.30, ge=0.0, le=1.0, description="Peso de la dimensión ubicación")
  habitos_confort: float = Field(
      0.15, ge=0.0, le=1.0, description="Peso de la dimensión hábitos/confort"
  )
  amenities: float = Field(
      0.15, ge=0.0, le=1.0, description="Peso de la dimensión amenities"
  )
  garantias: float = Field(
      0.10, ge=0.0, le=1.0, description="Peso de la dimensión garantías"
  )


class UserPreferences(BaseModel):
  """Perfil de preferencias y hábitos del inquilino."""

  model_config = ConfigDict(
      json_schema_extra={
          "example": {
              "presupuesto_max": 250000,
              "moneda_preferida": "ARS",
              "tiene_garantia_recibo": True,
              "tiene_garantia_prop": False,
              "multiplo_sueldo": 0.0,
              "tipologia_preferida": "depto",
              "cant_dormitorios_min": 1,
              "cant_banos_min": 1,
              "tiene_mascota": True,
              "requiere_cochera": True,
              "prefiere_cochera": True,
              "hace_home_office": True,
              "nivel_tolerancia_ruido": "bajo",
              "hace_deporte": True,
              "lat_trabajo": -27.469,
              "lon_trabajo": -58.830,
              "distancia_max_trabajo_km": 5.0,
              "pesos_usuario": {
                  "precio": 0.30,
                  "ubicacion": 0.30,
                  "habitos_confort": 0.15,
                  "amenities": 0.15,
                  "garantias": 0.10,
              },
          }
      }
  )

  id_inquilino: int = Field(1, description="Identificador del inquilino")

  presupuesto_max: float = Field(
      250000, gt=0, description="Límite superior mensual"
  )
  presupuesto_max_usd: Optional[float] = Field(
      None,
      gt=0,
      description="Tope adicional en USD (los montos no son comparables "
      "entre monedas). Null = sin tope en USD.",
  )
  superficie_min: Optional[float] = Field(
      None, ge=0, description="Superficie mínima deseada (m²)"
  )
  expensas_max: Optional[float] = Field(
      None, ge=0, description="Tope mensual de expensas"
  )
  requiere_quincho: bool = Field(
      False, description="Quincho en el edificio deseable (soft)"
  )
  requiere_terraza: bool = Field(
      False, description="Terraza en el edificio deseable (soft)"
  )
  requiere_piscina: bool = Field(
      False, description="Piscina en el edificio deseable (soft)"
  )
  requiere_ascensor: bool = Field(
      False, description="Ascensor en el edificio deseable (soft)"
  )
  planta_baja_deseada: bool = Field(
      False, description="Planta baja deseable (soft)"
  )
  duracion_min: Optional[int] = Field(
      None, ge=1, description="Duración mínima de contrato deseada (meses)"
  )
  moneda_preferida: str = Field(
      "indistinta",
      description="Moneda preferida del precio: 'ARS', 'USD' o 'indistinta'",
  )
  tiene_garantia_recibo: bool = Field(False, description="Posee recibo de sueldo")
  tiene_garantia_prop: bool = Field(False, description="Posee garantía propietaria")
  multiplo_sueldo: float = Field(0.0, ge=0, description="Múltiplo de sueldo demostrable")

  tipologia_preferida: str = Field("depto", description="depto, casa, monoambiente")
  cant_dormitorios_min: int = Field(1, ge=0, description="Dormitorios mínimos")
  cant_banos_min: int = Field(1, ge=0, description="Baños mínimos")
  tiene_mascota: bool = Field(False, description="El inquilino tiene mascota")
  tipo_mascota: Optional[str] = Field(None, description="Ej: perro_mediano")
  tamano_mascota: Optional[str] = Field(
      None, description="Tamaño de la mascota: chico / mediano / grande"
  )
  requiere_cocina_separada: bool = Field(
      False, description="Cocina separada deseable (soft)"
  )
  cocina_comedor_deseada: bool = Field(
      False, description="Cocina-comedor (integrada) deseable (soft)"
  )
  requiere_patio: bool = Field(False, description="Patio deseable (soft)")
  patio_cesped_deseado: bool = Field(
      False, description="Patio con césped deseable (soft)"
  )
  orientacion_preferida: str = Field(
      "indistinta",
      description="Orientación preferida: frente / contrafrente / indistinta",
  )
  acepta_pension: bool = Field(
      False, description="Acepta vivir en pensión (baño/cocina compartido)"
  )
  preferencia_alquiler: str = Field(
      "indistinta",
      description="Preferencia de alquiler con jerarquía: indistinta / "
      "inmobiliaria_primero / dueno_primero",
  )
  requiere_living_separado: bool = Field(
      False, description="Living separado deseable (soft)"
  )
  requiere_lavadero: bool = Field(False, description="Lavadero deseable (soft)")
  requiere_cochera: bool = Field(False, description="Cochera obligatoria (filtro duro)")
  prefiere_cochera: bool = Field(False, description="Cochera deseable (soft)")
  requiere_balcon: bool = Field(False, description="Balcón deseable")
  requiere_amoblado: bool = Field(False, description="Amoblado deseable")

  hace_home_office: bool = Field(False, description="Valora espacio de trabajo / bajo ruido")
  nivel_tolerancia_ruido: str = Field("indiferente", description="'bajo' o 'indiferente'")
  frecuencia_cocina: str = Field("media", description="alta, media, baja")
  frecuencia_lavado: str = Field("media", description="alta, media, baja")
  hace_deporte: bool = Field(False, description="Valora cercanía a plazas/parques")
  tiene_hijos: bool = Field(
      False, description="Tiene hijos (valora más dormitorios)"
  )
  va_al_gimnasio: bool = Field(
      False, description="Va al gimnasio (valora tener gimnasio en el edificio)"
  )

  medio_transporte_principal: str = Field(
      "colectivo", description="auto, colectivo, a_pie, bici"
  )
  lat_trabajo: float = Field(..., description="Latitud del trabajo")
  lon_trabajo: float = Field(..., description="Longitud del trabajo")
  distancia_max_trabajo_km: float = Field(
      5.0, ge=0, description="Radio máximo tolerable antes de penalizar"
  )

  pesos_usuario: PesosUsuario = Field(default_factory=PesosUsuario)

  zona_tipo: Optional[str] = Field(
      None, description="radio / poligono (null = sin zona)"
  )
  zona_lat: Optional[float] = Field(None, description="Centro de la zona (modo radio)")
  zona_lon: Optional[float] = Field(None, description="Centro de la zona (modo radio)")
  zona_radio_km: Optional[float] = Field(
      None, ge=0, description="Radio de la zona en km (modo radio)"
  )
  zona_puntos: Optional[List[PuntoGeo]] = Field(
      None, description="5 vértices de la zona (modo poligono)"
  )

class RecomendacionItem(Inmueble):
  """Inmueble rankeado: campos de la propiedad + features y sub-scores (XAI)."""

  distancia_trabajo: float = Field(..., description="Distancia al trabajo (km)")
  margen_presupuesto: float = Field(
      ..., description="Holgura respecto del presupuesto máximo"
  )
  match_cochera: int = Field(..., description="Coincidencia de cochera (0/1)")
  tiene_balcon: int = Field(..., description="Tiene balcón (0/1)")
  es_silencioso: int = Field(..., description="Es silencioso (0/1)")
  proximidad_salud: float = Field(
      ..., description="Puntaje de cercanía a salud (0.0-1.0)"
  )
  proximidad_verde: float = Field(
      ..., description="Puntaje de cercanía a plazas/parques (0.0-1.0)"
  )
  match_garantia: float = Field(
      ..., description="Compatibilidad de garantías (0.0/1.0)"
  )
  preferencia_match: int = Field(
      1,
      description="¿El inmueble es vía la vía preferida (inmobiliaria / dueño)? "
      "(0/1). 1 cuando es indistinta.",
  )
  zona_match: int = Field(
      1,
      description="¿El inmueble cae dentro de la zona elegida? (0/1). "
      "1 cuando no hay zona definida.",
  )

  score_precio: float = Field(..., description="Sub-score de precio (0.0-1.0)")
  score_ubicacion: float = Field(..., description="Sub-score de ubicación (0.0-1.0)")
  score_habitos_confort: float = Field(
      ..., description="Sub-score de hábitos/confort (0.0-1.0)"
  )
  score_amenities: float = Field(..., description="Sub-score de amenities (0.0-1.0)")
  score_garantias: float = Field(..., description="Sub-score de garantías (0.0-1.0)")
  score_compatibilidad: float = Field(
      ..., description="Score final de compatibilidad (0-100), ya penalizado por "
      "los datos faltantes del inmueble"
  )
  factor_completitud: float = Field(
      1.0,
      description="Factor de penalización por datos faltantes (0.5-1.0). "
      "1.0 = inmueble con carga completa.",
  )
  feedback: List[str] = Field(
      default_factory=list,
      description="Tipos de feedback que el inquilino ya registró sobre este "
      "inmueble (favorito / me_gusta / visto / contacto / ...).",
  )
class RecommendResponse(BaseModel):
  """Respuesta del ranking de recomendaciones."""

  count: int = Field(..., description="Cantidad de inmuebles devueltos")
  results: List[RecomendacionItem] = Field(
      ..., description="Inmuebles ordenados por score_compatibilidad"
  )
