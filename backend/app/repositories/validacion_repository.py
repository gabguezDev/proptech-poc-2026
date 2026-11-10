"""Acceso a datos de las validaciones de afirmaciones refutadas."""

import time
from typing import List, Optional

from sqlalchemy import select

from app.models.entidades import Validacion
from src import db


def _a_dict(fila: Validacion) -> dict:
  return {
      "id": fila.id,
      "id_inmueble": fila.id_inmueble,
      "detalle": fila.detalle,
      "foto_url": fila.foto_url,
      "lat": fila.lat,
      "lon": fila.lon,
      "distancia_medida": fila.distancia_medida,
      "distancia_declarada": fila.distancia_declarada,
      "resultado": fila.resultado,
      "creado": fila.creado,
  }


class RepositorioValidaciones:
  """Persistencia de las validaciones con foto. `fabrica` aísla la base."""

  def __init__(self, fabrica=None):
    self._fabrica = fabrica

  def _fab(self):
    return self._fabrica or db.fabrica()

  def listar_por_inmueble(self, id_inmueble: int) -> List[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.scalars(
          select(Validacion)
          .where(Validacion.id_inmueble == id_inmueble)
          .order_by(Validacion.creado.desc())
      ).all()
      return [_a_dict(fila) for fila in filas]

  def crear(self, id_inmueble: int, detalle: str, foto_url: Optional[str],
            lat: Optional[float], lon: Optional[float],
            distancia_medida: Optional[float], distancia_declarada: Optional[float],
            resultado: str) -> dict:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = Validacion(
          id_inmueble=id_inmueble,
          detalle=detalle,
          foto_url=foto_url,
          lat=lat,
          lon=lon,
          distancia_medida=distancia_medida,
          distancia_declarada=distancia_declarada,
          resultado=resultado,
          creado=time.time(),
      )
      sesion.add(fila)
      sesion.flush()
      return _a_dict(fila)
