"""Pipeline de recomendación: modelo, penalización por carga y feedback.

Orden del pipeline para un perfil de inquilino:

  1. `recommender.predict`: filtros duros, features y score de compatibilidad.
  2. `aplicar_penalizacion_completitud`: penaliza inmuebles con datos faltantes.
  3. `aplicar_ranking` (feedback): excluye los "no me gusta" y aplica boost.
  4. Top-K.

El modelo activo es `LGBMRecommender`. Si no existe el `.pkl` entrenado, se
entrena por destilación al arrancar (cold start).
"""

from typing import Optional

from app.services.ajuste_service import ServicioAjustes, obtener_servicio_ajustes
from app.services.feedback_service import ServicioFeedback
from app.repositories.feedback_repository import RepositorioFeedback
from app.services.inmueble_service import ServicioInmuebles
from app.repositories.inmueble_repository import RepositorioInmuebles
from src.completeness import aplicar_penalizacion_completitud
from src.config import FEATURE_COLS, LGBM_MODEL_PATH
from src.utils import punto_en_poligono, punto_en_radio

_recommender = None


def inicializar_recommender():
  """Crea el modelo activo: lo carga de disco o lo entrena al vuelo."""
  global _recommender
  from src.models.lgbm_model import LGBMRecommender

  modelo = LGBMRecommender(feature_cols=FEATURE_COLS)
  if LGBM_MODEL_PATH.exists():
    modelo.load(LGBM_MODEL_PATH)
  else:
    modelo._fit_cold_start()
  _recommender = modelo
  return modelo


def obtener_recommender():
  if _recommender is None:
    return inicializar_recommender()
  return _recommender


class ServicioRecomendacion:
  """Caso de uso `/recommend`: ranking para el perfil de un inquilino."""

  def __init__(self, modelo, inmuebles: ServicioInmuebles,
               feedback: ServicioFeedback, ajustes: ServicioAjustes):
    self._modelo = modelo
    self._inmuebles = inmuebles
    self._feedback = feedback
    self._ajustes = ajustes

  @staticmethod
  def _aplicar_preferencia_alquiler(ranking_df, perfil: dict):
    """Jerarquía de vía de alquiler: inmobiliaria o dueño directo.

    La vía preferida recibe boost (x1.10) y la otra penaliza (x0.95), con
    jerarquía clara: el usuario elige cuál viene primero. Sin preferencia,
    no cambia nada. Inmueble con agente a cargo = vía inmobiliaria; con solo
    propietario = dueño directo.
    """
    preferencia = perfil.get("preferencia_alquiler")
    if preferencia not in ("inmobiliaria_primero", "dueno_primero"):
      resultado = ranking_df.copy()
      resultado["preferencia_match"] = 1
      return resultado

    def es_inmobiliaria(fila) -> bool:
      agente = fila.get("agente_email")
      return bool(
          agente is not None
          and not (isinstance(agente, float) and agente != agente)
          and str(agente).strip() != ""
      )

    es_inmob = ranking_df.apply(es_inmobiliaria, axis=1)
    if preferencia == "inmobiliaria_primero":
      coincide = es_inmob
    else:
      coincide = ~es_inmob
    resultado = ranking_df.copy()
    resultado["preferencia_match"] = coincide.astype(int)
    factor = coincide.map({True: 1.10, False: 0.95})
    resultado["score_compatibilidad"] = (
        resultado["score_compatibilidad"] * factor
    ).clip(upper=100.0).round(2)
    return resultado.sort_values("score_compatibilidad", ascending=False)

  @staticmethod
  def _aplicar_zona(ranking_df, perfil: dict):
    """Match de zona: dentro de la zona elegida suma, fuera penaliza.

    Sin zona definida, `zona_match` es 1 y el score no cambia. Con zona, el
    sub-score de ubicación se mezcla 50/50 con el match de zona y el score
    final recibe el mismo factor (dentro: sin cambio; fuera: x0.7).
    """
    tipo = perfil.get("zona_tipo")
    if tipo not in ("radio", "poligono"):
      ranking_df = ranking_df.copy()
      ranking_df["zona_match"] = 1
      return ranking_df

    if tipo == "radio":
      centro_lat = perfil.get("zona_lat")
      centro_lon = perfil.get("zona_lon")
      radio = perfil.get("zona_radio_km")
      if centro_lat is None or centro_lon is None or not radio:
        ranking_df = ranking_df.copy()
        ranking_df["zona_match"] = 1
        return ranking_df
      dentro = ranking_df.apply(
          lambda fila: punto_en_radio(
              fila["lat"], fila["lon"], centro_lat, centro_lon, radio
          ),
          axis=1,
      )
    else:
      puntos = perfil.get("zona_puntos") or []
      dentro = ranking_df.apply(
          lambda fila: punto_en_poligono(fila["lat"], fila["lon"], puntos),
          axis=1,
      )

    resultado = ranking_df.copy()
    resultado["zona_match"] = dentro.astype(int)
    if "score_ubicacion" in resultado.columns:
      resultado["score_ubicacion"] = (
          0.5 * resultado["score_ubicacion"] + 0.5 * resultado["zona_match"]
      ).round(4)
    factor = resultado["zona_match"].map({1: 1.0, 0: 0.7})
    resultado["score_compatibilidad"] = (
        resultado["score_compatibilidad"] * factor
    ).round(2)
    resultado = resultado.sort_values(
        "score_compatibilidad", ascending=False
    )
    return resultado

  def nombre_modelo(self) -> str:
    return type(self._modelo).__name__

  def recomendar(self, usuario_email: str, perfil: dict, top_k: Optional[int]):
    """Devuelve la lista de registros rankeados, anotados con su feedback previo."""
    df_properties = self._inmuebles.load_properties()
    self._feedback.guardar_perfil(usuario_email, perfil)

    ranking_df = self._modelo.predict(df_properties, perfil)
    ranking_df = aplicar_penalizacion_completitud(ranking_df)
    ranking_df = self._aplicar_zona(ranking_df, perfil)
    ranking_df = self._aplicar_preferencia_alquiler(ranking_df, perfil)

    boost = self._ajustes.obtener().get("boost_feedback", 1.0)
    ranking_df, mapa_feedback = self._feedback.aplicar_ranking(
        ranking_df, usuario_email, boost=boost
    )

    if top_k and top_k > 0:
      ranking_df = ranking_df.head(top_k)

    registros = ranking_df.to_dict(orient="records")
    for registro in registros:
      registro["feedback"] = mapa_feedback.get(registro["id_inmueble"], [])
    return registros


def servicio_recomendacion() -> ServicioRecomendacion:
  """Servicio de recomendación con las dependencias del proceso."""
  return ServicioRecomendacion(
      obtener_recommender(),
      ServicioInmuebles(RepositorioInmuebles()),
      ServicioFeedback(RepositorioFeedback()),
      obtener_servicio_ajustes(),
  )
