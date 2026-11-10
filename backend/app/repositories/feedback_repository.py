"""Acceso a datos del feedback del inquilino y de los perfiles consultados.

Tablas `feedback` (una fila por usuario, inmueble y tipo) y
`perfiles_consultados` (último perfil de cada seeker). Las reglas de negocio
(upsert con repeticiones, reacciones excluyentes, ranking) viven en
`app.services.feedback_service`.
"""

from typing import Dict, List, Optional

from sqlalchemy import delete, func, select

from app.models.entidades import FeedbackEntrada, PerfilConsultado
from src import db
from src.feedback_tipos import SEPARADOR_DETALLE


def _a_dict(fila: FeedbackEntrada) -> dict:
  tipo = fila.tipo
  detalle = None
  if tipo and SEPARADOR_DETALLE in tipo:
    tipo, detalle = tipo.split(SEPARADOR_DETALLE, 1)
  return {
      "id": fila.id,
      "usuario_email": fila.usuario_email,
      "id_inmueble": fila.id_inmueble,
      "tipo": tipo,
      "detalle": detalle,
      "repeticiones": fila.repeticiones,
      "creado": fila.creado,
      "actualizado": fila.actualizado,
  }


class RepositorioFeedback:
  """Persistencia del feedback y de los perfiles. `fabrica` permite aislar la base."""

  def __init__(self, fabrica=None):
    self._fabrica = fabrica

  def _fab(self):
    return self._fabrica or db.fabrica()

  def obtener_entrada(self, usuario_email: str, id_inmueble: int,
                      tipo: str) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = self._buscar(sesion, usuario_email, id_inmueble, tipo)
      return _a_dict(fila) if fila else None

  def crear_entrada(self, usuario_email: str, id_inmueble: int, tipo: str,
                    ahora: float) -> dict:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = FeedbackEntrada(usuario_email=usuario_email, id_inmueble=id_inmueble,
                             tipo=tipo, repeticiones=1, creado=ahora,
                             actualizado=ahora)
      sesion.add(fila)
      sesion.flush()
      return _a_dict(fila)

  def actualizar_entrada(self, usuario_email: str, id_inmueble: int, tipo: str,
                         ahora: float, repeticiones: Optional[int] = None) -> dict:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = self._buscar(sesion, usuario_email, id_inmueble, tipo)
      if repeticiones is not None:
        fila.repeticiones = repeticiones
      fila.actualizado = ahora
      sesion.flush()
      return _a_dict(fila)

  def quitar_tipo(self, usuario_email: str, id_inmueble: int, tipo: str) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      sesion.execute(
          delete(FeedbackEntrada)
          .where(FeedbackEntrada.usuario_email == usuario_email)
          .where(FeedbackEntrada.id_inmueble == id_inmueble)
          .where(FeedbackEntrada.tipo == tipo)
      )

  def eliminar(self, usuario_email: str, id_inmueble: int,
               tipo: Optional[str] = None) -> int:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      consulta = (
          delete(FeedbackEntrada)
          .where(FeedbackEntrada.usuario_email == usuario_email)
          .where(FeedbackEntrada.id_inmueble == id_inmueble)
      )
      if tipo is not None:
        consulta = consulta.where(FeedbackEntrada.tipo == tipo)
      return sesion.execute(consulta).rowcount or 0

  def listar_usuario(self, usuario_email: str,
                     tipo: Optional[str] = None) -> List[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      consulta = (
          select(FeedbackEntrada)
          .where(FeedbackEntrada.usuario_email == usuario_email)
          .order_by(FeedbackEntrada.id)
      )
      if tipo is not None:
        consulta = consulta.where(FeedbackEntrada.tipo == tipo)
      return [_a_dict(fila) for fila in sesion.scalars(consulta).all()]

  def listar_todos(self) -> List[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.scalars(select(FeedbackEntrada).order_by(FeedbackEntrada.id)).all()
      return [_a_dict(fila) for fila in filas]

  def conteo_por_tipo(self, id_inmueble: int) -> Dict[str, int]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.execute(
          select(FeedbackEntrada.tipo, func.count())
          .where(FeedbackEntrada.id_inmueble == id_inmueble)
          .group_by(FeedbackEntrada.tipo)
      ).all()
    return {tipo: int(cantidad) for tipo, cantidad in filas}

  def guardar_perfil(self, usuario_email: str, perfil: dict, ahora: float) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(PerfilConsultado, usuario_email)
      if fila is None:
        sesion.add(PerfilConsultado(usuario_email=usuario_email, perfil=dict(perfil),
                                    actualizado=ahora))
      else:
        fila.perfil = dict(perfil)
        fila.actualizado = ahora

  def obtener_perfil(self, usuario_email: str) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(PerfilConsultado, usuario_email)
      if fila is None:
        return None
      return dict(fila.perfil or {}, actualizado=fila.actualizado)

  def listar_perfiles(self) -> Dict[str, dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.scalars(select(PerfilConsultado)).all()
      return {
          fila.usuario_email: dict(fila.perfil or {}, actualizado=fila.actualizado)
          for fila in filas
      }

  @staticmethod
  def _buscar(sesion, usuario_email: str, id_inmueble: int,
              tipo: str) -> Optional[FeedbackEntrada]:
    return sesion.scalar(
        select(FeedbackEntrada)
        .where(FeedbackEntrada.usuario_email == usuario_email)
        .where(FeedbackEntrada.id_inmueble == id_inmueble)
        .where(FeedbackEntrada.tipo == tipo)
    )
