"""Esquemas Pydantic (contrato HTTP) de la propiedad (oferta)."""

from typing import Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator


class FotoInmueble(BaseModel):
  """Una foto (o video) de la galería, etiquetada por ambiente.

  `ambiente2`/`numero2` permiten una segunda etiqueta (living + comedor).
  Las fotos subidas sin etiqueta se guardan como URLs planas (compatibilidad
  con la semilla) y cuentan como la sección "otros".
  """

  url: str = Field(..., description="URL pública del archivo")
  ambiente: str = Field("otros", description="Ambiente que muestra la foto")
  numero: Optional[int] = Field(
      None, description="N.º de dormitorio/baño (1 = principal)"
  )
  ambiente2: Optional[str] = Field(None, description="Segunda etiqueta opcional")
  numero2: Optional[int] = Field(None, description="N.º de la segunda etiqueta")
  orden: int = Field(0, description="Posición en la galería")
  portada: bool = Field(False, description="Foto principal de la publicación")

class AmbienteCombinado(BaseModel):
  """Un ambiente formado uniendo píldoras (Living, Comedor, Cocina, Lavadero).

  `espacios` trae las píldoras unidas: ["living", "comedor"] = living comedor;
  ["cocina", "comedor"] = cocina comedor; una sola = ambiente separado.
  `separado` aplica a ambientes de un solo espacio (Lavadero separado).
  `numero` distingue instancias repetibles (dormitorio 1, baño 2…).
  """

  espacios: List[str] = Field(..., description="Píldoras unidas en el ambiente")
  separado: bool = Field(False, description="Separado del resto de los espacios")
  numero: Optional[int] = Field(None, description="N.º de instancia (dormitorio 2, baño 1…)")

  @model_validator(mode="before")
  @classmethod
  def _legacy(cls, datos):
    """Acepta entradas legacy con un solo `ambiente`."""
    if isinstance(datos, dict) and "espacios" not in datos and "ambiente" in datos:
      return {
          "espacios": [datos["ambiente"]],
          "separado": bool(datos.get("separado")),
      }
    return datos


class ExpensasIncluye(BaseModel):
  """Servicios y conceptos incluidos en las expensas del inmueble."""

  agua_potable: bool = Field(..., description="Incluye agua potable")
  gas: bool = Field(..., description="Incluye gas")
  energia_electrica_espacios_comunes: bool = Field(
      ..., description="Incluye electricidad de espacios comunes"
  )
  energia_electrica_departamento: bool = Field(
      ..., description="Incluye electricidad del departamento"
  )
  limpieza_espacios_comunes: bool = Field(
      ..., description="Incluye limpieza de espacios comunes"
  )
  guardia_camaras: bool = Field(
      ..., description="Incluye guardia y/o cámaras de seguridad"
  )
  mano_obra_mantenimiento: bool = Field(
      ..., description="Incluye mano de obra de mantenimiento"
  )
  mantenimiento_ascensor: bool = Field(
      ..., description="Incluye mantenimiento de ascensor"
  )

  @model_validator(mode="before")
  @classmethod
  def _unificar_guardia_camaras(cls, datos):
    """Acepta registros legacy con `camaras_seguridad`/`guardia_seguridad`."""
    if isinstance(datos, dict) and "guardia_camaras" not in datos:
      datos = {
          **datos,
          "guardia_camaras": bool(
              datos.get("camaras_seguridad") or datos.get("guardia_seguridad")
          ),
      }
    return datos
  otros: List[str] = Field(
      default_factory=list, description="Otros ítems incluidos en las expensas"
  )


class Expensas(BaseModel):
  """Expensas del inmueble."""

  promedio_ultimos_3_meses: float = Field(
      ..., description="Expensas promedio de los últimos 3 meses (ARS)"
  )
  incluye: ExpensasIncluye


class Edificio(BaseModel):
  """Amenities del inmueble (aplica si el tipo de unidad los tiene:
  edificio, complejo, casa o ph; no en unidades internas)."""

  tiene_ascensor: bool = Field(..., description="El edificio tiene ascensor")
  tiene_quincho: bool = Field(..., description="El edificio tiene quincho")
  quincho_ubicacion: Optional[str] = Field(
      None, description="planta_baja / terraza (null si no tiene quincho)"
  )
  tiene_terraza: bool = Field(..., description="El edificio tiene terraza")
  terraza_incluida_expensas: bool = Field(
      ..., description="El uso de la terraza está incluido en las expensas"
  )
  tiene_gimnasio: bool = Field(..., description="El edificio tiene gimnasio")
  tiene_piscina: bool = Field(..., description="El edificio tiene piscina")
  otros_amenities: List[str] = Field(
      default_factory=list, description="Otros amenities del edificio"
  )


class Proximidad(BaseModel):
  """Distancias (en metros) a puntos de interés del entorno.

  Clasificación: < 500 m = cercano, 500-<1000 m = mediano, >= 1000 m = lejano.
  Todos opcionales: `null` = sin datos (el alta carga por bandas).
  """

  distancia_quiosco_m: Optional[float] = Field(None, description="Distancia a un quiosco (m)")
  distancia_autoservicio_m: Optional[float] = Field(
      None, description="Distancia a un autoservicio (m)"
  )
  distancia_supermercado_m: Optional[float] = Field(
      None, description="Distancia a un supermercado (m)"
  )
  distancia_hipermercado_m: Optional[float] = Field(
      None, description="Distancia a un hipermercado (m)"
  )
  distancia_plaza_m: Optional[float] = Field(None, description="Distancia a una plaza (m)")
  distancia_parque_m: Optional[float] = Field(None, description="Distancia a un parque (m)")
  distancia_escuela_m: Optional[float] = Field(None, description="Distancia a una escuela (m)")
  distancia_colegio_m: Optional[float] = Field(None, description="Distancia a un colegio (m)")
  distancia_instituto_terciario_m: Optional[float] = Field(
      None, description="Distancia a un instituto terciario (m)"
  )
  distancia_universidad_m: Optional[float] = Field(
      None, description="Distancia a una universidad (m)"
  )
  distancia_caps_m: Optional[float] = Field(
      None, description="Distancia a un CAPS de atención primaria (m)"
  )
  distancia_hospital_m: Optional[float] = Field(None, description="Distancia a un hospital (m)")
  distancia_clinica_m: Optional[float] = Field(None, description="Distancia a una clínica (m)")
  distancia_estacionamiento_m: Optional[float] = Field(
      None, description="Distancia a estacionamiento medido (m)"
  )


class Contrato(BaseModel):
  """Condiciones contractuales ofrecidas por el inmueble (informativas)."""

  duracion_meses: Optional[int] = Field(
      None, description="Duración del contrato en meses (null si a convenir)"
  )
  duracion_a_convenir: bool = Field(
      ..., description="La duración se puede convenir"
  )
  frecuencia_aumento_meses: int = Field(
      ..., description="Cada cuántos meses se ajusta el alquiler"
  )
  indice_ajuste: str = Field(..., description="ICL / IPC / propietario")
  frecuencia_aumento_a_convenir: bool = Field(
      ..., description="La frecuencia de ajuste se puede convenir"
  )


class Garantias(BaseModel):
  """Garantías que acepta el inmueble (se cruzan con el perfil del inquilino)."""

  seguro_caucion: bool = Field(..., description="Acepta seguro de caución")
  garantia_a_propietario: bool = Field(
      ..., description="Acepta garantía a propietario"
  )
  garantia_a_propietario_reembolsable: Optional[bool] = Field(
      None, description="Esa garantía se devuelve al final (null si no aplica)"
  )
  titulo_propiedad: bool = Field(..., description="Acepta título de propiedad")


class Pension(BaseModel):
  """Datos de una pensión (habitación privada con espacios compartidos).

  Solo aplica cuando `tipologia == 'pension'`.
  """

  bano_compartido: bool = Field(..., description="El baño es compartido")
  cocina_compartida: bool = Field(..., description="La cocina es compartida")
  comedor_compartido: bool = Field(..., description="El comedor es compartido")
  lavadero_compartido: bool = Field(..., description="El lavadero es compartido")
  otros_espacios_compartidos: List[str] = Field(
      default_factory=list, description="Otros espacios compartidos"
  )


class Inmueble(BaseModel):
  """Campos que se le solicitan a la PROPIEDAD (oferta del catálogo)."""

  id_inmueble: int = Field(..., description="Identificador del inmueble")
  precio: float = Field(..., description="Precio mensual del alquiler")
  moneda: str = Field(..., description="Moneda del precio: ARS / USD")
  moneda_a_convenir: bool = Field(
      ..., description="La moneda del precio se puede pactar"
  )
  expensas: Optional[Expensas] = Field(
      None, description="Expensas (null si el propietario no las cargó)"
  )

  tipologia: str = Field(
      ..., description="departamento / monoambiente / casa / pension"
  )
  es_monoambiente: bool = Field(..., description="Indica si es monoambiente")
  cantidad_habitaciones: int = Field(..., description="Cantidad de habitaciones")
  cantidad_banos: int = Field(..., description="Cantidad de baños")
  cantidad_banos_en_suite: int = Field(
      ..., description="Cantidad de baños en suite"
  )
  piso: int = Field(..., description="Planta del depto (0 = planta baja)")
  acceso: Optional[str] = Field(
      None, description="Acceso de la unidad: escalera / ascensor"
  )
  orientacion: str = Field(..., description="frente / contrafrente")
  tipo_unidad: str = Field(
      ...,
      description="edificio / complejo (barrio cerrado) / casa (independiente) / "
      "ph (planta baja, propiedad horizontal) / interno",
  )
  cocina_separada: bool = Field(..., description="Cocina separada del comedor")
  living_separado: bool = Field(..., description="Living separado del comedor")
  tiene_lavadero: bool = Field(..., description="Tiene lavadero")
  lavadero_separado: bool = Field(..., description="Lavadero separado de la cocina")
  balcon_ubicacion: str = Field(
      ..., description="frente / contrafrente / ambos / no_tiene"
  )
  ambientes: Optional[List[AmbienteCombinado]] = Field(
      None,
      description="Ambientes combinados por el dueño (orden visual + flag "
      "separado). El scoring usa los booleanos derivados.",
  )
  tiene_patio: Optional[bool] = Field(None, description="Tiene patio")
  patio_cesped: Optional[bool] = Field(
      None, description="El patio tiene césped (null si no tiene patio)"
  )

  acepta_mascotas: bool = Field(..., description="Acepta mascotas")
  tamano_maximo_mascota: Optional[str] = Field(
      None,
      description="Tamaño máximo de mascota aceptado: chico / mediano / grande / "
      "indistinto (sin límite, con inquilino responsable). Null = sin declarar.",
  )
  tiene_cochera: bool = Field(..., description="Tiene cochera")
  cochera_techada: bool = Field(..., description="La cochera es techada")
  espacio_moto_bicicleta: Optional[bool] = Field(
      None, description="Espacio para motocicleta o bicicleta"
  )

  lat: float = Field(..., description="Latitud del inmueble")
  lon: float = Field(..., description="Longitud del inmueble")
  proximidad: Optional[Proximidad] = Field(
      None, description="Distancias del entorno (null si no se cargaron)"
  )

  edificio: Optional[Edificio] = Field(
      None, description="Amenities del edificio (null si no se cargaron)"
  )
  contrato: Optional[Contrato] = Field(
      None, description="Condiciones contractuales (null si no se cargaron)"
  )
  garantias: Optional[Garantias] = Field(
      None, description="Garantías aceptadas (null si no se cargaron)"
  )
  pension: Optional[Pension] = Field(
      None, description="Datos de pensión (solo si tipologia == 'pension')"
  )

  titulo: Optional[str] = Field(None, description="Título del anuncio")
  direccion: Optional[str] = Field(
      None, description="Dirección completa (calle, número, barrio)"
  )
  superficie: Optional[float] = Field(None, description="Superficie total (m²)")
  estado: str = Field(
      "publicado",
      description="Estado de publicación: borrador / publicado / alquilada / no_disponible",
  )
  fotos: List[Union[str, FotoInmueble]] = Field(
      default_factory=list,
      description="Galería de fotos (URLs planas o fotos etiquetadas por "
      "ambiente, máx. 15)",
  )

  score_carga: float = Field(
      0.0,
      description="Completitud de los datos del inmueble (0-100). A mayor carga, "
      "mayor probabilidad de matchear.",
  )


class InmuebleGestionado(Inmueble):
  """Inmueble visto por quien lo gestiona: agrega la propiedad (ownership)."""

  propietario_email: Optional[str] = Field(
      None, description="Email del propietario del inmueble (null si no se asignó)"
  )
  agente_email: Optional[str] = Field(
      None, description="Email del agente inmobiliario que lo gestiona (o null)"
  )


class InmuebleCreate(Inmueble):
  """Alta de un inmueble.

  Reutiliza los campos del esquema `Inmueble`. La propiedad (`propietario_email`
  / `agente_email`) la asigna el servidor según quién crea el inmueble. El
  `id_inmueble` es opcional (se asigna automáticamente si se omite).
  """

  id_inmueble: Optional[int] = Field(
      None, description="Id del inmueble (se asigna automáticamente si se omite)"
  )


_CAMPOS_UPDATE = {
    nombre: (Optional[campo.annotation], None)
    for nombre, campo in Inmueble.model_fields.items()
    if nombre not in ("id_inmueble", "score_carga")
}
InmuebleUpdate = create_model("InmuebleUpdate", **_CAMPOS_UPDATE)
InmuebleUpdate.__doc__ = (
    "Edición parcial de un inmueble: solo se actualizan los campos enviados "
    "(los bloques anidados, si se envían, van completos)."
)
class CampoFaltante(BaseModel):
  """Campo del inmueble que el propietario todavía no cargó."""

  campo: str = Field(..., description="Ruta del campo (ej. 'proximidad.distancia_hospital_m')")
  etiqueta: str = Field(..., description="Nombre legible del campo")
  critico: bool = Field(..., description="Si es un campo crítico para matchear")


class CompletitudResponse(BaseModel):
  """Detalle del score de carga de un inmueble (lado propietario)."""

  id_inmueble: int = Field(..., description="Identificador del inmueble")
  score_carga: float = Field(..., description="Score de carga total (0-100)")
  grupos: Dict[str, float] = Field(
      ..., description="Score de carga (0-100) por grupo de campos"
  )
  faltantes: List[CampoFaltante] = Field(
      ..., description="Campos sin cargar (con su etiqueta y criticidad)"
  )
  secciones_fotos: List[str] = Field(
      default_factory=list,
      description="Secciones cubiertas por las fotos etiquetadas "
      "(ej. 'Dormitorio 2'); la cobertura completa exige 6",
  )
