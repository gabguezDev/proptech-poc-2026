"""Roles, contraseñas y credenciales de sesión.

Contraseñas: **bcrypt** (sal aleatoria por contraseña y factor de costo
configurable). Los hashes PBKDF2-HMAC-SHA256 generados antes del cambio siguen
verificándose y se re-hashean a bcrypt en el próximo inicio de sesión exitoso.
Sesiones: credenciales opacas (`secrets.token_urlsafe`) que se guardan con
vencimiento, por lo que se pueden revocar del lado del servidor.
"""

import hashlib
import hmac
import secrets
from typing import Optional

import bcrypt

ROL_ADMIN = "admin"
ROL_PROPIETARIO = "prop_owner"
ROL_AGENTE = "real_estate_agent"
ROL_SEEKER = "seeker"
ROL_VISITOR = "visitor"

ROLES = (ROL_ADMIN, ROL_PROPIETARIO, ROL_AGENTE, ROL_SEEKER, ROL_VISITOR)
ROLES_AUTENTICADOS = (ROL_ADMIN, ROL_PROPIETARIO, ROL_AGENTE, ROL_SEEKER)
ROLES_AUTORREGISTRO = (ROL_SEEKER, ROL_PROPIETARIO, ROL_AGENTE)

BCRYPT_COSTO = 12
PBKDF2_ITERACIONES = 200_000
TOKEN_TTL_SEGUNDOS = 7 * 24 * 3600
PASSWORD_MIN_LARGO = 8
PASSWORD_MAX_BYTES = 72
CARACTERES_ESPECIALES = "!@#$%^&*()-_=+[]{};:,.<>/?|~`'\"\\"


def validar_password(password: str) -> Optional[str]:
  """Política de contraseñas: devuelve el motivo del rechazo o None si es válida.

  Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y
  un carácter especial. Máximo 72 bytes (límite de bcrypt).
  """
  if len(password or "") < PASSWORD_MIN_LARGO:
    return "La contraseña debe tener al menos {0} caracteres".format(PASSWORD_MIN_LARGO)
  if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
    return "La contraseña no puede superar {0} bytes".format(PASSWORD_MAX_BYTES)
  if not any(c.isupper() for c in password):
    return "La contraseña debe incluir al menos una mayúscula"
  if not any(c.islower() for c in password):
    return "La contraseña debe incluir al menos una minúscula"
  if not any(c.isdigit() for c in password):
    return "La contraseña debe incluir al menos un número"
  if not any(c in CARACTERES_ESPECIALES for c in password):
    return "La contraseña debe incluir al menos un carácter especial"
  return None


def hash_password(password: str) -> str:
  """Devuelve el hash bcrypt (incluye sal y costo en el propio hash)."""
  return bcrypt.hashpw(
      password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_COSTO)
  ).decode("ascii")


def _verificar_pbkdf2(password: str, hash_almacenado: str) -> bool:
  """Verificación de hashes PBKDF2 anteriores (`pbkdf2_sha256$it$salt$hash`)."""
  try:
    algoritmo, iteraciones, salt, hash_esperado = hash_almacenado.split("$")
    if algoritmo != "pbkdf2_sha256":
      return False
    derivada = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iteraciones)
    )
    return hmac.compare_digest(derivada.hex(), hash_esperado)
  except (ValueError, AttributeError):
    return False


def verificar_password(password: str, hash_almacenado: str) -> bool:
  """Compara una contraseña con su hash (bcrypt o PBKDF2 heredado)."""
  if not hash_almacenado:
    return False
  if hash_almacenado.startswith("$2"):
    try:
      return bcrypt.checkpw(password.encode("utf-8"), hash_almacenado.encode("ascii"))
    except ValueError:
      return False
  return _verificar_pbkdf2(password, hash_almacenado)


def necesita_rehash(hash_almacenado: str) -> bool:
  """¿El hash es de un algoritmo anterior y debe migrarse a bcrypt?"""
  return not (hash_almacenado or "").startswith("$2")


def nuevo_token() -> str:
  """Credencial opaca de sesión."""
  return secrets.token_urlsafe(32)
