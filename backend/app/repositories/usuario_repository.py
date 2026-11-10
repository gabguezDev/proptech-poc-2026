"""Acceso a datos de usuarios y sesiones (tablas `usuarios` y `sesiones`).

Solo consulta y persiste: las reglas (validaciones, bloqueo, revocación) viven en
`app.services.auth_service`.
"""

from typing import List, Optional

from sqlalchemy import delete, select

from app.models.entidades import Sesion, Usuario
from src import db


def _a_dict(fila: Usuario) -> dict:
  """Vista completa de un usuario (incluye el hash de contraseña)."""
  return {
      "id": fila.id,
      "email": fila.email,
      "nombre": fila.nombre,
      "rol": fila.rol,
      "password_hash": fila.password_hash,
      "creado": fila.creado,
      "bloqueado": bool(fila.bloqueado),
  }


class RepositorioUsuarios:
  """Persistencia de usuarios y sesiones. `fabrica` permite aislar la base."""

  def __init__(self, fabrica=None):
    self._fabrica = fabrica

  def _fab(self):
    return self._fabrica or db.fabrica()

  def por_email(self, email: str) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.scalar(select(Usuario).where(Usuario.email == email))
      return _a_dict(fila) if fila else None

  def por_id(self, usuario_id: int) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Usuario, usuario_id)
      return _a_dict(fila) if fila else None

  def insertar(self, email: str, nombre: str, rol: str, password_hash: str,
               creado: float) -> dict:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = Usuario(email=email, nombre=nombre, rol=rol,
                     password_hash=password_hash, creado=creado, bloqueado=False)
      sesion.add(fila)
      sesion.flush()
      return _a_dict(fila)

  def listar(self) -> List[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      filas = sesion.scalars(select(Usuario).order_by(Usuario.id)).all()
      return [_a_dict(fila) for fila in filas]

  def actualizar_password_hash(self, usuario_id: int, password_hash: str) -> None:
    """Reemplaza el hash (migración de PBKDF2 a bcrypt en el login)."""
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Usuario, usuario_id)
      if fila is not None:
        fila.password_hash = password_hash

  def actualizar_rol(self, usuario_id: int, rol: str) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Usuario, usuario_id)
      if fila is None:
        return None
      fila.rol = rol
      return _a_dict(fila)

  def fijar_bloqueo(self, usuario_id: int, bloqueado: bool) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Usuario, usuario_id)
      if fila is None:
        return None
      fila.bloqueado = bloqueado
      sesion.flush()
      return _a_dict(fila)

  def eliminar(self, usuario_id: int) -> bool:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Usuario, usuario_id)
      if fila is None:
        return False
      sesion.execute(delete(Sesion).where(Sesion.usuario_id == usuario_id))
      sesion.delete(fila)
    return True

  def insertar_sesion(self, token: str, usuario_id: int, expira: float) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      sesion.add(Sesion(token=token, usuario_id=usuario_id, expira=expira))

  def usuario_de_token(self, token: str) -> Optional[dict]:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Sesion, token)
      if fila is None:
        return None
      usuario = sesion.get(Usuario, fila.usuario_id)
      return _a_dict(usuario) if usuario else None

  def borrar_sesion(self, token: str) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      sesion.execute(delete(Sesion).where(Sesion.token == token))

  def borrar_sesiones_de_usuario(self, usuario_id: int) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      sesion.execute(delete(Sesion).where(Sesion.usuario_id == usuario_id))

  def borrar_sesiones_vencidas(self, ahora: float) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      sesion.execute(delete(Sesion).where(Sesion.expira < ahora))

  def expirar_sesion(self, token: str, expira: float) -> None:
    with db.sesion_de_trabajo(self._fab()) as sesion:
      fila = sesion.get(Sesion, token)
      if fila is not None:
        fila.expira = expira
