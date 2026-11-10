"""Helpers de presentación: anotan diccionarios con valores calculados.

La capa de presentación (controladores) usa estas funciones para agregar lo que
el modelo no persiste: el `score_carga`, el resumen del inmueble en el feedback
y la respuesta de autenticación.
"""

from typing import Optional

from app.core.seguridad import ROL_ADMIN, ROL_AGENTE, ROL_PROPIETARIO
from src.completeness import calcular_score_carga


def con_score_carga(registro: dict) -> dict:
  """Copia del registro con su score_carga calculado."""
  registro = dict(registro)
  registro["score_carga"] = calcular_score_carga(registro)
  return registro


def respuesta_token(usuario: dict, token: str) -> dict:
  """Arma la respuesta de autenticación a partir del usuario y su token."""
  return {
      "access_token": token,
      "token_type": "bearer",
      "rol": usuario["rol"],
      "email": usuario["email"],
      "nombre": usuario["nombre"],
  }


def ownership_del_creador(usuario: dict):
  """(propietario_email, agente_email) a asignar según el rol que crea."""
  rol = usuario["rol"]
  if rol == ROL_PROPIETARIO:
    return usuario["email"], None
  if rol == ROL_AGENTE:
    return None, usuario["email"]
  return None, None


def item_feedback(entrada: dict, inmuebles) -> dict:
  """Entrada de feedback + resumen del inmueble referenciado."""
  item = dict(entrada)
  registro = inmuebles.obtener(entrada["id_inmueble"])
  if registro is not None:
    item["inmueble"] = con_score_carga(registro)
  return item
