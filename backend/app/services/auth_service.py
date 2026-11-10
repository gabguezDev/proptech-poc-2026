"""Reglas de autenticación, sesiones y gestión de usuarios.

Las validaciones, el hash de contraseñas, el bloqueo y la revocación de sesiones
se resuelven aquí. El acceso a la base pasa por `RepositorioUsuarios`.
"""

import time
from typing import List, Optional

from app.core import cuentas_semilla as cuentas
from app.core.seguridad import (
    ROL_ADMIN,
    ROL_PROPIETARIO,
    ROL_SEEKER,
    ROL_AGENTE,
    ROLES_AUTENTICADOS,
    ROLES_AUTORREGISTRO,
    TOKEN_TTL_SEGUNDOS,
    hash_password,
    necesita_rehash,
    nuevo_token,
    validar_password,
    verificar_password,
)
from app.repositories.usuario_repository import RepositorioUsuarios


class ServicioAuth:
  """Casos de uso de usuarios y sesiones."""

  def __init__(self, repositorio: RepositorioUsuarios):
    self._repo = repositorio

  def por_email(self, email: str) -> Optional[dict]:
    return self._repo.por_email((email or "").strip().lower())

  def obtener(self, usuario_id: int) -> Optional[dict]:
    return self._repo.por_id(usuario_id)

  def registrar(self, email: str, password: str, nombre=None,
                rol: str = ROL_SEEKER) -> dict:
    """Registra un usuario. Lanza ValueError si los datos no son válidos."""
    email = (email or "").strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
      raise ValueError("Email inválido")
    motivo = validar_password(password or "")
    if motivo:
      raise ValueError(motivo)
    if rol not in ROLES_AUTORREGISTRO:
      raise ValueError("Rol no permitido para autorregistro: {0}".format(rol))
    if self.por_email(email):
      raise ValueError("Ya existe un usuario registrado con ese email")
    return self._crear(email, (nombre or email.split("@")[0]).strip(), rol, password)

  def autenticar(self, email: str, password: str) -> Optional[dict]:
    usuario = self.por_email(email)
    if not usuario or not verificar_password(password or "", usuario["password_hash"]):
      return None
    if necesita_rehash(usuario["password_hash"]):
      self._repo.actualizar_password_hash(usuario["id"], hash_password(password))
      usuario["password_hash"] = self._repo.por_id(usuario["id"])["password_hash"]
    return usuario

  def crear_sesion(self, usuario: dict) -> str:
    token = nuevo_token()
    self._repo.insertar_sesion(token, usuario["id"], time.time() + TOKEN_TTL_SEGUNDOS)
    return token

  def usuario_por_token(self, token: str) -> Optional[dict]:
    """Usuario de la credencial. None si no existe, venció o la cuenta está bloqueada."""
    self._repo.borrar_sesiones_vencidas(time.time())
    usuario = self._repo.usuario_de_token(token)
    if usuario is None or usuario["bloqueado"]:
      return None
    return usuario

  def cerrar_sesion(self, token: str) -> None:
    self._repo.borrar_sesion(token)

  def caducar_sesion(self, token: str) -> None:
    """Fuerza el vencimiento de una sesión. Uso: pruebas de expiración."""
    self._repo.expirar_sesion(token, time.time() - 1)

  def sembrar_admin(self) -> Optional[dict]:
    return self._sembrar_cuenta(cuentas.admin_email(), cuentas.admin_password(),
                                "Administrador", ROL_ADMIN)

  def sembrar_cuentas_demo(self) -> List[dict]:
    creadas = []
    for email, password, nombre, rol in (
        (cuentas.email_propietario_demo(), cuentas.password_propietario_demo(),
         "Propietario Demo", ROL_PROPIETARIO),
        (cuentas.email_agente_demo(), cuentas.password_agente_demo(),
         "Agente Demo", ROL_AGENTE),
    ):
      cuenta = self._sembrar_cuenta(email, password, nombre, rol)
      if cuenta is not None:
        creadas.append(cuenta)
    return creadas

  def sembrar_cuenta_buscador(self) -> Optional[dict]:
    return self._sembrar_cuenta(cuentas.email_buscador_demo(),
                                cuentas.password_buscador_demo(),
                                "Buscador Demo", ROL_SEEKER)

  def listar(self) -> List[dict]:
    return [self._publico(usuario) for usuario in self._repo.listar()]

  def cambiar_rol(self, usuario_id: int, rol: str) -> Optional[dict]:
    if rol not in ROLES_AUTENTICADOS:
      raise ValueError("Rol inválido: {0}".format(rol))
    actualizado = self._repo.actualizar_rol(usuario_id, rol)
    return self._publico(actualizado) if actualizado else None

  def bloquear(self, usuario_id: int, bloqueado: bool) -> Optional[dict]:
    """Bloquea o desbloquea. Al bloquear, revoca las sesiones activas."""
    actualizado = self._repo.fijar_bloqueo(usuario_id, bloqueado)
    if actualizado is None:
      return None
    if bloqueado:
      self._repo.borrar_sesiones_de_usuario(usuario_id)
    return self._publico(actualizado)

  def eliminar(self, usuario_id: int) -> bool:
    return self._repo.eliminar(usuario_id)

  def _crear(self, email: str, nombre: str, rol: str, password: str) -> dict:
    return self._repo.insertar(email, nombre, rol, hash_password(password), time.time())

  def _sembrar_cuenta(self, email, password, nombre, rol) -> Optional[dict]:
    email = (email or "").strip().lower()
    if self.por_email(email):
      return None
    return self._crear(email, nombre, rol, password)

  @staticmethod
  def _publico(usuario: dict) -> dict:
    """Vista pública de un usuario (sin hash de contraseña)."""
    return {
        "id": usuario["id"],
        "email": usuario["email"],
        "nombre": usuario["nombre"],
        "rol": usuario["rol"],
        "bloqueado": usuario.get("bloqueado", False),
    }


_servicio: Optional[ServicioAuth] = None


def obtener_servicio_auth() -> ServicioAuth:
  """Servicio de autenticación del proceso (se crea con la base global)."""
  global _servicio
  if _servicio is None:
    _servicio = ServicioAuth(RepositorioUsuarios())
  return _servicio


def fijar_servicio_auth(servicio: Optional[ServicioAuth]) -> None:
  """Reemplaza la instancia del proceso (tests que aíslan la base)."""
  global _servicio
  _servicio = servicio
