"""Acceso a datos del catálogo de trabajo (tabla `inmuebles`).

Convierte filas ORM en diccionarios con las columnas de la tabla (esquema del
inmueble + ownership). No decide qué campos son editables: eso lo resuelve
`app.services.inmueble_service`.
"""

from typing import List, Optional

import pandas as pd
from sqlalchemy import func, select

from app.models.entidades import Inmueble
from src import db

COLUMNAS = [columna.key for columna in Inmueble.__table__.columns]


def _a_dict(fila: Inmueble) -> dict:
  registro = {clave: getattr(fila, clave) for clave in COLUMNAS}
  if registro.get("fotos") is None:
    registro["fotos"] = []
  if registro.get("estado") is None:
    registro["estado"] = "publicado"
  return registro


def _aplicar(fila: Inmueble, valores: dict) -> None:
  for clave, valor in valores.items():
    if clave in COLUMNAS and clave != "id_inmueble":
      setattr(fila, clave, valor)


class RepositorioInmuebles:
  """Persistencia del catálogo de trabajo. `fabrica` permite aislar la base."""

  def __init__(self, fabrica=None):
    self._fabrica = fabrica

  def _fab(self):
    return self._fabrica or db.fabrica()

  def listar(self) -> List[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.scalars(select(Inmueble).order_by(Inmueble.id_inmueble)).all()
      return [_a_dict(fila) for fila in filas]

  def listar_dataframe(self) -> pd.DataFrame:
    registros = self.listar()
    if not registros:
      return pd.DataFrame(columns=COLUMNAS)
    df = pd.DataFrame(registros)
    for columna in ("superficie", "titulo", "direccion"):
      if columna in df.columns:
        df[columna] = df[columna].astype(object).where(pd.notna(df[columna]), None)
    return df

  def obtener(self, id_inmueble: int) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Inmueble, id_inmueble)
      return _a_dict(fila) if fila else None

  def contar(self) -> int:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      return int(sesion.scalar(select(func.count()).select_from(Inmueble)) or 0)

  def maximo_id(self) -> Optional[int]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      maximo = sesion.scalar(select(func.max(Inmueble.id_inmueble)))
    return int(maximo) if maximo is not None else None

  def insertar(self, datos: dict) -> dict:
    """Inserta una fila con `datos` (incluye `id_inmueble` y el ownership)."""
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = Inmueble(id_inmueble=datos["id_inmueble"])
      _aplicar(fila, datos)
      sesion.add(fila)
      sesion.flush()
      return _a_dict(fila)

  def actualizar(self, id_inmueble: int, cambios: dict) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Inmueble, id_inmueble)
      if fila is None:
        return None
      _aplicar(fila, cambios)
      sesion.flush()
      return _a_dict(fila)
