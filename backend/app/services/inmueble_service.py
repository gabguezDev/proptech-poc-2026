"""Reglas del catálogo de inmuebles: alta, edición, ownership y siembra.

- La **semilla** inmutable es `data/mock_properties.json`. Si la tabla `inmuebles`
  está vacía, `sembrar` la carga asignando la propiedad demo.
- **Ownership**: cada inmueble lleva `propietario_email` / `agente_email`. No
  forman parte del payload público; solo los ve quien gestiona el inmueble.
- Los campos calculados por el servidor (`score_carga`) y los de control de
  acceso no se pueden fijar desde el cuerpo de una edición.
"""

import json
from functools import lru_cache
from typing import List, Optional

import pandas as pd

from app.repositories.inmueble_repository import COLUMNAS, RepositorioInmuebles
from app.core.seguridad import ROL_ADMIN, ROL_AGENTE, ROL_PROPIETARIO
from src.config import DEFAULT_DATA_PATH

CAMPO_PROPIETARIO = "propietario_email"
CAMPO_AGENTE = "agente_email"
CAMPOS_CALCULADOS = ("score_carga",)
_CAMPOS_NO_EDITABLES = set(CAMPOS_CALCULADOS) | {CAMPO_PROPIETARIO, CAMPO_AGENTE}

_SEMILLA_PROPIEDAD = {
    101: ("owner",),
    102: ("owner",),
    103: ("owner",),
    104: ("owner", "agent"),
    105: ("agent",),
    106: ("agent",),
}


@lru_cache(maxsize=1)
def _semilla() -> List[dict]:
  """Lee el catálogo semilla inmutable."""
  return json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))


class ServicioInmuebles:
  """Casos de uso del catálogo de trabajo."""

  def __init__(self, repositorio: RepositorioInmuebles):
    self._repo = repositorio

  def listar(self) -> List[dict]:
    return self._repo.listar()

  def load_properties(self) -> pd.DataFrame:
    """Catálogo público: solo inmuebles publicados.

    Los borradores, las alquiladas y las no disponibles no se exponen.
    """
    df = self._repo.listar_dataframe()
    if "estado" in df.columns:
      df = df[df["estado"].fillna("publicado") == "publicado"]
    return df

  def obtener(self, id_inmueble: int) -> Optional[dict]:
    return self._repo.obtener(id_inmueble)

  def proximo_id(self) -> int:
    maximo = self._repo.maximo_id()
    return (maximo + 1) if maximo is not None else 101

  def crear(self, datos: dict, propietario_email: Optional[str] = None,
            agente_email: Optional[str] = None) -> dict:
    """Crea un inmueble con la propiedad indicada. ValueError si el id ya existe."""
    nuevo = {k: v for k, v in datos.items() if k not in _CAMPOS_NO_EDITABLES}
    id_solicitado = nuevo.pop("id_inmueble", None)
    if id_solicitado is None:
      id_solicitado = self.proximo_id()
    if self._repo.obtener(id_solicitado) is not None:
      raise ValueError("Ya existe un inmueble con id {0}".format(id_solicitado))
    nuevo["id_inmueble"] = id_solicitado
    nuevo[CAMPO_PROPIETARIO] = propietario_email
    nuevo[CAMPO_AGENTE] = agente_email
    if nuevo.get("estado", "publicado") not in (
        "borrador",
        "publicado",
        "alquilada",
        "no_disponible",
    ):
      raise ValueError("Estado inválido: {0}".format(nuevo["estado"]))
    nuevo.setdefault("estado", "publicado")
    nuevo.setdefault("fotos", [])
    return self._repo.insertar(nuevo)

  def actualizar(self, id_inmueble: int, cambios: dict) -> Optional[dict]:
    """Fusiona los campos editables. None si el inmueble no existe."""
    if "estado" in cambios and cambios["estado"] not in (
        "borrador",
        "publicado",
        "alquilada",
        "no_disponible",
    ):
      raise ValueError("Estado inválido: {0}".format(cambios["estado"]))
    editables = {
        k: v for k, v in cambios.items()
        if k not in _CAMPOS_NO_EDITABLES and k != "id_inmueble" and k in COLUMNAS
    }
    return self._repo.actualizar(id_inmueble, editables)

  @staticmethod
  def gestiona(registro: dict, usuario: Optional[dict]) -> bool:
    """¿El usuario puede ver el detalle y editar este inmueble?"""
    if not usuario:
      return False
    rol = usuario.get("rol")
    if rol == ROL_ADMIN:
      return True
    if rol == ROL_PROPIETARIO:
      return registro.get(CAMPO_PROPIETARIO) == usuario["email"]
    if rol == ROL_AGENTE:
      return registro.get(CAMPO_AGENTE) == usuario["email"]
    return False

  def gestionados_por(self, usuario: dict) -> List[dict]:
    """Inmuebles que el usuario gestiona (el admin ve todos)."""
    return [registro for registro in self.listar() if self.gestiona(registro, usuario)]

  def sembrar(self, propietario_email: Optional[str] = None,
              agente_email: Optional[str] = None) -> bool:
    """Carga la semilla si la tabla está vacía. Idempotente; True si sembró."""
    if self._repo.contar():
      return False
    por_rol = {"owner": propietario_email, "agent": agente_email}
    for registro in _semilla():
      roles = _SEMILLA_PROPIEDAD.get(registro["id_inmueble"], ())
      datos = {k: v for k, v in registro.items() if k in COLUMNAS}
      datos[CAMPO_PROPIETARIO] = por_rol["owner"] if "owner" in roles else None
      datos[CAMPO_AGENTE] = por_rol["agent"] if "agent" in roles else None
      self._repo.insertar(datos)
    return True

  def sembrar_extra(self, propietario_email: Optional[str] = None,
                    agente_email: Optional[str] = None) -> bool:
    """Carga las propiedades extra de Corrientes Capital (ids 201-210).

    Idempotente: si el 201 ya existe, no toca nada. Las fotos se suben
    después, con un script aparte, al almacenamiento local.
    """
    from src.datos_demo_extra import PROPIEDADES_EXTRA

    if self._repo.obtener(238) is not None:
      return False
    por_rol = {"owner": propietario_email, "agent": agente_email}
    for id_inmueble, dueno, datos in PROPIEDADES_EXTRA:
      if self._repo.obtener(id_inmueble) is not None:
        continue
      registro = {k: v for k, v in datos.items() if k in COLUMNAS}
      registro[CAMPO_PROPIETARIO] = por_rol["owner"] if dueno == "owner" else None
      registro[CAMPO_AGENTE] = por_rol["agent"] if dueno == "agent" else None
      self._repo.insertar(registro)
    return True


_servicio: Optional[ServicioInmuebles] = None


def obtener_servicio_inmuebles() -> ServicioInmuebles:
  global _servicio
  if _servicio is None:
    _servicio = ServicioInmuebles(RepositorioInmuebles())
  return _servicio


def fijar_servicio_inmuebles(servicio: Optional[ServicioInmuebles]) -> None:
  """Reemplaza la instancia del proceso (tests que aíslan la base)."""
  global _servicio
  _servicio = servicio
