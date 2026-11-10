"""Dependencias de FastAPI: servicios del proceso y control por roles.

Los controladores reciben los servicios por `Depends`, así no dependen de
singletons globales. La autorización se verifica acá (rol del token), nunca en
el controlador.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.seguridad import ROL_VISITOR
from app.services.ajuste_service import ServicioAjustes, obtener_servicio_ajustes
from app.services.auth_service import ServicioAuth, obtener_servicio_auth
from app.services.feedback_service import ServicioFeedback, obtener_servicio_feedback
from app.services.inmueble_service import ServicioInmuebles, obtener_servicio_inmuebles
from app.services.metricas_service import ServicioMetricas
from app.services.recomendacion_service import ServicioRecomendacion, servicio_recomendacion


def get_auth_service() -> ServicioAuth:
  return obtener_servicio_auth()


def get_inmueble_service() -> ServicioInmuebles:
  return obtener_servicio_inmuebles()


def get_feedback_service() -> ServicioFeedback:
  return obtener_servicio_feedback()


def get_ajuste_service() -> ServicioAjustes:
  return obtener_servicio_ajustes()


def get_recomendacion_service() -> ServicioRecomendacion:
  return servicio_recomendacion()


def get_metricas_service(
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    feedback: ServicioFeedback = Depends(get_feedback_service),
) -> ServicioMetricas:
  return ServicioMetricas(inmuebles, feedback)


_esquema_bearer = HTTPBearer(auto_error=False)


def usuario_actual(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(_esquema_bearer),
    auth: ServicioAuth = Depends(get_auth_service),
) -> Optional[dict]:
  """Usuario del token Bearer, o None (visitante)."""
  if credenciales is None:
    return None
  return auth.usuario_por_token(credenciales.credentials)


def requiere_roles(*roles_permitidos):
  """Dependencia que exige uno de los roles indicados.

  Sin credenciales se asume `visitor`: un endpoint sin `visitor` entre los
  permitidos queda restringido a usuarios autenticados.
  """

  def dependencia(usuario: Optional[dict] = Depends(usuario_actual)):
    rol = usuario["rol"] if usuario else ROL_VISITOR
    if rol not in roles_permitidos:
      if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )
      raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="El rol '{0}' no tiene permiso para esta operación".format(rol),
      )
    return usuario

  return dependencia
