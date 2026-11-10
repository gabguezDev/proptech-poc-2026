"""Acceso a datos de los ajustes administrables (tabla `ajustes`)."""

from typing import Dict

from sqlalchemy import select

from app.models.entidades import Ajuste
from src import db


class RepositorioAjustes:
  """Persistencia de los parámetros en caliente. `fabrica` permite aislar la base."""

  def __init__(self, fabrica=None):
    self._fabrica = fabrica

  def _fab(self):
    return self._fabrica or db.fabrica()

  def leer_todos(self) -> Dict[str, float]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      return {fila.clave: fila.valor for fila in sesion.scalars(select(Ajuste)).all()}

  def guardar(self, valores: Dict[str, float]) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      for clave, valor in valores.items():
        fila = sesion.get(Ajuste, clave)
        if fila is None:
          sesion.add(Ajuste(clave=clave, valor=float(valor)))
        else:
          fila.valor = float(valor)
