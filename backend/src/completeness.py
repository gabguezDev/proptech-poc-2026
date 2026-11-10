"""Score de carga (completitud) de un inmueble.

Mide qué tan completa está la información que cargó el propietario, ponderando
cada campo por su relevancia para el matching: cuantos más datos útiles haya,
mayor es la probabilidad de encontrar un interesado.

Conceptos:
  - **Campo**: una ruta dentro del inmueble (admite anidamiento, ej.
    `expensas.incluye.gas`) con un peso, un grupo y si es crítico.
  - **Crítico**: campo imprescindible para poder matchear (precio, moneda,
    ubicación, tipología, acepta_mascotas). Si falta alguno, el score se topea
    (ver `TOPE_SIN_CRITICOS`).
  - **Condicional**: campo que solo aplica en cierto contexto (ej. `edificio`
    solo si el tipo de unidad tiene amenities, es decir, no es `interno`). Si
    no aplica, no entra en el cálculo.
  - **Requerido**: sub-campo que solo se exige si otro lo habilita (ej.
    `quincho_ubicacion` solo si el edificio tiene quincho).

El score de carga además **penaliza** el `score_compatibilidad` del inquilino
(`factor_penalizacion_completitud`): un inmueble con datos faltantes tiene menos
chance de matchear, así que su compatibilidad se reduce proporcionalmente.
"""

from src.config import PENALIZACION_COMPLETITUD_MIN, SCORE_SCALE_MAX
from src.fotos import (
    UMBRAL_COBERTURA_SECCIONES,
    etiqueta_seccion,
    secciones_cubiertas,
)

TOPE_SIN_CRITICOS = 40.0

GRUPO_PRECIO = "precio"
GRUPO_UBICACION = "ubicacion"
GRUPO_FISICO = "fisico"
GRUPO_SERVICIOS = "servicios"
GRUPO_GARANTIAS = "garantias"
GRUPO_CONTRATO = "contrato"
GRUPO_EDIFICIO = "edificio"
GRUPO_PENSION = "pension"
GRUPO_PUBLICACION = "publicacion"


class _Campo:
  """Definición de un campo puntuable del inmueble."""

  def __init__(self, ruta, etiqueta, grupo, peso, critico=False,
               condicion=None, requerido=None, funcion=None):
    self.ruta = ruta
    self.etiqueta = etiqueta
    self.grupo = grupo
    self.peso = peso
    self.critico = critico
    self.condicion = condicion
    self.requerido = requerido
    self.funcion = funcion

  def aplica(self, inmueble):
    """¿El campo corresponde evaluarse para este inmueble?"""
    if self.condicion and not self.condicion(inmueble):
      return False
    if self.requerido and not self.requerido(inmueble):
      return False
    return True



def _valor(inmueble, ruta):
  """Obtiene un valor anidado del inmueble por ruta con puntos."""
  actual = inmueble
  for parte in ruta.split("."):
    if not isinstance(actual, dict) or parte not in actual:
      return None
    actual = actual[parte]
  return actual


def _completado(valor, ruta=None):
  """Determina si un valor cuenta como cargado.

  - None / cadena vacía / dict vacío  -> incompleto
  - False / 0 / lista vacía           -> completos (son valores válidos)
  - Excepción: `fotos` exige al menos una foto cargada (sin fotos, la
    publicación pierde atractivo y debe penalizar el score de carga).
  """
  if ruta == "fotos":
    return isinstance(valor, list) and len(valor) > 0
  if valor is None:
    return False
  if isinstance(valor, str):
    return valor.strip() != ""
  if isinstance(valor, dict):
    return len(valor) > 0
  return True



def _con_amenidades(inmueble):
  """¿El inmueble puede tener amenities del bloque `edificio`?

  Todo tipo de unidad salvo `interno`: un edificio, un complejo, una casa o
  un PH también pueden tener quincho, terraza, pileta, etc.
  """
  return _valor(inmueble, "tipo_unidad") != "interno"


def _es_pension(inmueble):
  return _valor(inmueble, "tipologia") == "pension"


CAMPOS = [
    _Campo("precio", "Precio del alquiler", GRUPO_PRECIO, 5, critico=True),
    _Campo("moneda", "Moneda del precio", GRUPO_PRECIO, 5, critico=True),
    _Campo("moneda_a_convenir", "Moneda pactable", GRUPO_PRECIO, 2),

    _Campo("lat", "Latitud", GRUPO_UBICACION, 5, critico=True),
    _Campo("lon", "Longitud", GRUPO_UBICACION, 5, critico=True),
    _Campo("proximidad.distancia_quiosco_m", "Cercanía a quiosco", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_autoservicio_m", "Cercanía a autoservicio", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_supermercado_m", "Cercanía a supermercado", GRUPO_UBICACION, 2),
    _Campo("proximidad.distancia_hipermercado_m", "Cercanía a hipermercado", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_plaza_m", "Cercanía a plaza", GRUPO_UBICACION, 2),
    _Campo("proximidad.distancia_parque_m", "Cercanía a parque", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_escuela_m", "Cercanía a escuela", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_colegio_m", "Cercanía a colegio", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_instituto_terciario_m", "Cercanía a instituto terciario", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_universidad_m", "Cercanía a universidad", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_caps_m", "Cercanía a CAPS", GRUPO_UBICACION, 1),
    _Campo("proximidad.distancia_hospital_m", "Cercanía a hospital", GRUPO_UBICACION, 2),
    _Campo("proximidad.distancia_clinica_m", "Cercanía a clínica", GRUPO_UBICACION, 2),

    _Campo("tipologia", "Tipología", GRUPO_FISICO, 5, critico=True),
    _Campo("es_monoambiente", "Es monoambiente", GRUPO_FISICO, 1),
    _Campo("cantidad_habitaciones", "Cantidad de habitaciones", GRUPO_FISICO, 3),
    _Campo("cantidad_banos", "Cantidad de baños", GRUPO_FISICO, 3),
    _Campo("cantidad_banos_en_suite", "Baños en suite", GRUPO_FISICO, 1),
    _Campo("piso", "Piso", GRUPO_FISICO, 1),
    _Campo("acceso", "Acceso de la unidad (escalera/ascensor)", GRUPO_FISICO, 1),
    _Campo("orientacion", "Orientación", GRUPO_FISICO, 2),
    _Campo("tipo_unidad", "Tipo de unidad", GRUPO_FISICO, 2),
    _Campo("cocina_separada", "Cocina separada", GRUPO_FISICO, 1),
    _Campo("living_separado", "Living separado", GRUPO_FISICO, 1),
    _Campo("tiene_lavadero", "Tiene lavadero", GRUPO_FISICO, 2),
    _Campo("lavadero_separado", "Lavadero separado", GRUPO_FISICO, 1),
    _Campo("balcon_ubicacion", "Ubicación del balcón", GRUPO_FISICO, 2),
    _Campo("tiene_patio", "Patio", GRUPO_FISICO, 2),
    _Campo("patio_cesped", "Patio con césped", GRUPO_FISICO, 1,
           requerido=lambda i: _valor(i, "tiene_patio") is True),

    _Campo("expensas.promedio_ultimos_3_meses", "Expensas promedio", GRUPO_SERVICIOS, 2),
    _Campo("expensas.incluye.agua_potable", "Expensas incluye agua", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.gas", "Expensas incluye gas", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.energia_electrica_espacios_comunes", "Expensas incluye electricidad de espacios comunes", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.energia_electrica_departamento", "Expensas incluye electricidad del depto", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.limpieza_espacios_comunes", "Expensas incluye limpieza", GRUPO_SERVICIOS, 1),
    _Campo(
        "expensas.incluye.guardia_camaras",
        "Expensas incluye guardia/cámaras",
        GRUPO_SERVICIOS,
        1,
        funcion=lambda i: (
            _valor(i, "expensas.incluye.guardia_camaras") is not None
            or _valor(i, "expensas.incluye.camaras_seguridad") is not None
            or _valor(i, "expensas.incluye.guardia_seguridad") is not None
        ),
    ),
    _Campo("expensas.incluye.mano_obra_mantenimiento", "Expensas incluye mantenimiento", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.mantenimiento_ascensor", "Expensas incluye ascensor", GRUPO_SERVICIOS, 1),
    _Campo("expensas.incluye.otros", "Otros ítems de expensas", GRUPO_SERVICIOS, 1),
    _Campo("acepta_mascotas", "Acepta mascotas", GRUPO_SERVICIOS, 5, critico=True),
    _Campo("tamano_maximo_mascota", "Tamaño máximo de mascota aceptado", GRUPO_SERVICIOS, 2,
           requerido=lambda i: _valor(i, "acepta_mascotas") is True),
    _Campo("tiene_cochera", "Tiene cochera", GRUPO_SERVICIOS, 3),
    _Campo("cochera_techada", "Cochera techada", GRUPO_SERVICIOS, 2),
    _Campo("espacio_moto_bicicleta", "Espacio para moto o bicicleta", GRUPO_SERVICIOS, 1),

    _Campo("garantias.seguro_caucion", "Acepta seguro de caución", GRUPO_GARANTIAS, 3),
    _Campo("garantias.garantia_a_propietario", "Acepta garantía propietaria", GRUPO_GARANTIAS, 3),
    _Campo("garantias.garantia_a_propietario_reembolsable", "Garantía propietaria reembolsable", GRUPO_GARANTIAS, 1,
           requerido=lambda i: _valor(i, "garantias.garantia_a_propietario") is True),
    _Campo("garantias.titulo_propiedad", "Acepta título de propiedad", GRUPO_GARANTIAS, 3),

    _Campo("contrato.duracion_meses", "Duración del contrato", GRUPO_CONTRATO, 2,
           requerido=lambda i: _valor(i, "contrato.duracion_a_convenir") is not True),
    _Campo("contrato.duracion_a_convenir", "Duración a convenir", GRUPO_CONTRATO, 1),
    _Campo("contrato.frecuencia_aumento_meses", "Frecuencia de aumento", GRUPO_CONTRATO, 2,
           requerido=lambda i: _valor(i, "contrato.frecuencia_aumento_a_convenir") is not True),
    _Campo("contrato.indice_ajuste", "Índice de ajuste", GRUPO_CONTRATO, 2),
    _Campo("contrato.frecuencia_aumento_a_convenir", "Frecuencia de aumento a convenir", GRUPO_CONTRATO, 1),

    _Campo("edificio.tiene_ascensor", "Edificio con ascensor", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.tiene_quincho", "Edificio con quincho", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.quincho_ubicacion", "Ubicación del quincho", GRUPO_EDIFICIO, 1,
           condicion=_con_amenidades,
           requerido=lambda i: _valor(i, "edificio.tiene_quincho") is True),
    _Campo("edificio.tiene_terraza", "Edificio con terraza", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.terraza_incluida_expensas", "Terraza incluida en expensas", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.tiene_gimnasio", "Edificio con gimnasio", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.tiene_piscina", "Edificio con piscina", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),
    _Campo("edificio.otros_amenities", "Otros amenities del edificio", GRUPO_EDIFICIO, 1, condicion=_con_amenidades),

    _Campo("fotos", "Fotos de la publicación", GRUPO_PUBLICACION, 5),
    _Campo(
        "cobertura_fotos",
        "Cobertura de secciones en las fotos",
        GRUPO_PUBLICACION,
        3,
        funcion=lambda i: len(secciones_cubiertas(i.get("fotos")))
        >= UMBRAL_COBERTURA_SECCIONES,
    ),
    _Campo("titulo", "Título del anuncio", GRUPO_PUBLICACION, 1),

    _Campo("pension.bano_compartido", "Baño compartido", GRUPO_PENSION, 1, condicion=_es_pension),
    _Campo("pension.cocina_compartida", "Cocina compartida", GRUPO_PENSION, 1, condicion=_es_pension),
    _Campo("pension.comedor_compartido", "Comedor compartido", GRUPO_PENSION, 1, condicion=_es_pension),
    _Campo("pension.lavadero_compartido", "Lavadero compartido", GRUPO_PENSION, 1, condicion=_es_pension),
    _Campo("pension.otros_espacios_compartidos", "Otros espacios compartidos", GRUPO_PENSION, 1, condicion=_es_pension),
]



def _esta_completo(campo, inmueble):
  """¿El campo cuenta como cargado? (usa `funcion` si es derivado)."""
  if campo.funcion is not None:
    return bool(campo.funcion(inmueble))
  return _completado(_valor(inmueble, campo.ruta), campo.ruta)


def calcular_score_carga(inmueble):
  """Calcula el score de carga (0-100) ponderando los campos completados.

  Si falta algún campo crítico, el score se limita a `TOPE_SIN_CRITICOS`.
  """
  total = 0.0
  obtenido = 0.0
  falta_critico = False

  for campo in CAMPOS:
    if not campo.aplica(inmueble):
      continue
    total += campo.peso
    if _esta_completo(campo, inmueble):
      obtenido += campo.peso
    elif campo.critico:
      falta_critico = True

  if total <= 0:
    return SCORE_SCALE_MAX

  score = SCORE_SCALE_MAX * obtenido / total
  if falta_critico:
    score = min(score, TOPE_SIN_CRITICOS)
  return round(score, 2)


def detalle_completitud(inmueble):
  """Devuelve el detalle del score de carga: grupos, faltantes e id."""
  faltantes = []
  acumulado = {}

  for campo in CAMPOS:
    if not campo.aplica(inmueble):
      continue
    grupo = acumulado.setdefault(campo.grupo, {"total": 0.0, "completos": 0.0})
    grupo["total"] += campo.peso
    if _esta_completo(campo, inmueble):
      grupo["completos"] += campo.peso
    else:
      faltantes.append({
          "campo": campo.ruta,
          "etiqueta": campo.etiqueta,
          "critico": campo.critico,
      })

  grupos = {
      nombre: round(SCORE_SCALE_MAX * datos["completos"] / datos["total"], 2)
      for nombre, datos in acumulado.items()
      if datos["total"] > 0
  }

  return {
      "id_inmueble": _valor(inmueble, "id_inmueble"),
      "score_carga": calcular_score_carga(inmueble),
      "grupos": grupos,
      "faltantes": faltantes,
      "secciones_fotos": sorted(
          etiqueta_seccion(ambiente, numero)
          for ambiente, numero in secciones_cubiertas(inmueble.get("fotos"))
      ),
  }



def factor_penalizacion_completitud(score_carga):
  """Factor multiplicativo (0-1] aplicado al score de compatibilidad.

  score_carga = 100 -> 1.0 (sin penalización)
  score_carga = 0   -> penalizacion_completitud_min (ajustable por el admin)

  El mínimo se lee de los ajustes administrables (`app/services/ajuste_service.py`),
  de modo que un administrador puede cambiar la severidad sin tocar el código.
  """
  from app.services.ajuste_service import obtener_ajustes

  minimo = obtener_ajustes().get(
      "penalizacion_completitud_min", PENALIZACION_COMPLETITUD_MIN
  )
  fraccion = max(0.0, min(1.0, score_carga / SCORE_SCALE_MAX))
  return minimo + (1.0 - minimo) * fraccion


def aplicar_penalizacion_completitud(df, columna_score="score_compatibilidad"):
  """Agrega score_carga / factor_completitud y penaliza el score de compatibilidad.

  Un inmueble con datos faltantes tiene menos probabilidad de matchear, por lo
  que su compatibilidad se reduce proporcionalmente. Devuelve el DataFrame
  reordenado por el score final.
  """
  df = df.copy()
  detector = df.apply(lambda fila: calcular_score_carga(fila.to_dict()), axis=1)
  df["score_carga"] = detector.round(2)
  df["factor_completitud"] = detector.apply(
      factor_penalizacion_completitud
  ).round(4)
  df["score_compatibilidad"] = (
      df[columna_score] * df["factor_completitud"]
  ).round(2)

  columnas_numericas = df.select_dtypes(include="number").columns
  df[columnas_numericas] = df[columnas_numericas].fillna(0.0)

  return df.sort_values(
      by="score_compatibilidad", ascending=False
  ).reset_index(drop=True)
