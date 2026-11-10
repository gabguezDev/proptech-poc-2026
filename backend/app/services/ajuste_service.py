"""Parámetros de la plataforma ajustables en caliente por el administrador.

A diferencia de `src/config.py` (constantes que solo cambian con el código), estos
valores se modifican desde `/admin/config` y se persisten en la tabla `ajustes`.
La carga es perezosa: si la base todavía no está disponible se usan los valores
por defecto de `config.py`.
"""

from typing import Optional

from app.repositories.ajuste_repository import RepositorioAjustes
from src.config import BOOST_FEEDBACK_DEFAULT, PENALIZACION_COMPLETITUD_MIN

DEFECTOS = {
    "penalizacion_completitud_min": PENALIZACION_COMPLETITUD_MIN,
    "boost_feedback": BOOST_FEEDBACK_DEFAULT,
}


class ServicioAjustes:
  """Lectura y actualización de los ajustes, con caché en memoria."""

  def __init__(self, repositorio: RepositorioAjustes):
    self._repo = repositorio
    self._ajustes = dict(DEFECTOS)
    self._cargado = False

  def cargar(self) -> dict:
    """Carga los ajustes persistidos sobre los valores por defecto."""
    self._ajustes = dict(DEFECTOS)
    try:
      for clave, valor in self._repo.leer_todos().items():
        if clave in DEFECTOS:
          self._ajustes[clave] = valor
    except Exception:
      pass
    self._cargado = True
    return dict(self._ajustes)

  def obtener(self) -> dict:
    if not self._cargado:
      self.cargar()
    return dict(self._ajustes)

  def actualizar(self, penalizacion_completitud_min: Optional[float] = None,
                 boost_feedback: Optional[float] = None) -> dict:
    if not self._cargado:
      self.cargar()
    if penalizacion_completitud_min is not None:
      self._ajustes["penalizacion_completitud_min"] = float(penalizacion_completitud_min)
    if boost_feedback is not None:
      self._ajustes["boost_feedback"] = float(boost_feedback)
    self._repo.guardar(self._ajustes)
    return self.obtener()


_servicio: Optional[ServicioAjustes] = None


def obtener_servicio_ajustes() -> ServicioAjustes:
  global _servicio
  if _servicio is None:
    _servicio = ServicioAjustes(RepositorioAjustes())
  return _servicio


def fijar_servicio_ajustes(servicio: Optional[ServicioAjustes]) -> None:
  """Reemplaza la instancia del proceso (tests que aíslan la base)."""
  global _servicio
  _servicio = servicio


def obtener_ajustes() -> dict:
  """Atajo para los módulos que solo leen (p. ej. la penalización por completitud)."""
  return obtener_servicio_ajustes().obtener()
