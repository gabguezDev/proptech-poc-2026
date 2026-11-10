"""Cuentas que se siembran al primer arranque.

Cada email y contraseña se puede sobreescribir con variables de entorno
(`ADMIN_*`, `OWNER_*`, `AGENT_*`, `SEEKER_*`).
"""

import os

ADMIN_EMAIL_DEFAULT = "admin@proptech.local"
ADMIN_PASSWORD_DEFAULT = "admin12345"
OWNER_EMAIL_DEFAULT = "dueno@proptech.local"
OWNER_PASSWORD_DEFAULT = "dueno12345"
AGENT_EMAIL_DEFAULT = "agente@proptech.local"
AGENT_PASSWORD_DEFAULT = "agente12345"
SEEKER_EMAIL_DEFAULT = "buscador@proptech.local"
SEEKER_PASSWORD_DEFAULT = "buscador12345"


def admin_email() -> str:
  return os.environ.get("ADMIN_EMAIL", ADMIN_EMAIL_DEFAULT).strip().lower()


def admin_password() -> str:
  return os.environ.get("ADMIN_PASSWORD", ADMIN_PASSWORD_DEFAULT)


def email_propietario_demo() -> str:
  """Email de la cuenta demo de propietario (rol `prop_owner`)."""
  return os.environ.get("OWNER_EMAIL", OWNER_EMAIL_DEFAULT).strip().lower()


def password_propietario_demo() -> str:
  return os.environ.get("OWNER_PASSWORD", OWNER_PASSWORD_DEFAULT)


def email_agente_demo() -> str:
  """Email de la cuenta demo de agente inmobiliario (rol `real_estate_agent`)."""
  return os.environ.get("AGENT_EMAIL", AGENT_EMAIL_DEFAULT).strip().lower()


def password_agente_demo() -> str:
  return os.environ.get("AGENT_PASSWORD", AGENT_PASSWORD_DEFAULT)


def email_buscador_demo() -> str:
  """Email de la cuenta demo de inquilino (rol `seeker`), con feedback sembrado."""
  return os.environ.get("SEEKER_EMAIL", SEEKER_EMAIL_DEFAULT).strip().lower()


def password_buscador_demo() -> str:
  return os.environ.get("SEEKER_PASSWORD", SEEKER_PASSWORD_DEFAULT)
