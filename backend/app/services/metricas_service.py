"""Evaluación offline del ranking: oráculo sintético y feedback real.

Los parámetros del oráculo son fijos (`METRICAS_*`) para que la evaluación sea
reproducible. La lógica de métricas vive en `src/evaluacion.py` y `src/metrics.py`.
"""

from app.services.feedback_service import ServicioFeedback
from app.services.inmueble_service import ServicioInmuebles
from src.evaluacion import comparar_modelos, comparar_modelos_feedback
from src.models.lgbm_model import generar_perfiles_sinteticos

METRICAS_K_VALUES = (5, 10)
METRICAS_PROP_RELEVANTES = 0.3
METRICAS_SEED = 1234


class ServicioMetricas:
  """Casos de uso de `/admin/metricas` y `/admin/metricas/feedback`."""

  def __init__(self, inmuebles: ServicioInmuebles, feedback: ServicioFeedback):
    self._inmuebles = inmuebles
    self._feedback = feedback

  def evaluar_catalogo(self, perfiles: int) -> dict:
    """Compara los modelos contra el oráculo sintético sobre el catálogo de trabajo."""
    df_properties = self._inmuebles.load_properties()
    lista_perfiles = generar_perfiles_sinteticos(
        n_perfiles=perfiles, seed=METRICAS_SEED
    )
    resultados = comparar_modelos(
        df_properties,
        lista_perfiles,
        k_values=METRICAS_K_VALUES,
        prop_relevantes=METRICAS_PROP_RELEVANTES,
        seed=METRICAS_SEED,
    )
    return {
        "perfiles_solicitados": len(lista_perfiles),
        "prop_relevantes": METRICAS_PROP_RELEVANTES,
        "seed": METRICAS_SEED,
        "resultados": resultados,
    }

  def evaluar_feedback(self) -> dict:
    """Compara los modelos usando el feedback real como verdad, por usuario."""
    df_properties = self._inmuebles.load_properties()
    resultados = comparar_modelos_feedback(
        df_properties, self._feedback, k_values=METRICAS_K_VALUES
    )
    return {
        "usuarios": max((r["perfiles"] for r in resultados), default=0),
        "resultados": resultados,
    }
