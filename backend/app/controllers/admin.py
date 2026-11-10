"""Controlador de administración: config, usuarios y métricas (solo `admin`)."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencias import (
    get_ajuste_service,
    get_auth_service,
    get_feedback_service,
    get_inmueble_service,
    get_metricas_service,
    requiere_roles,
)
from app.core.seguridad import ROL_ADMIN
from app.schemas.auth import (
    BloqueoUpdate,
    ConfigResponse,
    ConfigUpdate,
    RolUpdate,
    UsuarioResponse,
)
from app.schemas.feedback import FeedbackItem
from app.schemas.metricas import MetricasFeedbackResponse, MetricasResponse
from app.services.ajuste_service import ServicioAjustes
from app.services.auth_service import ServicioAuth
from app.services.feedback_service import ServicioFeedback
from app.services.inmueble_service import ServicioInmuebles
from app.services.metricas_service import ServicioMetricas
from app.utils.presentacion import item_feedback

router = APIRouter(tags=["Administración"])


@router.get(
    "/admin/config",
    response_model=ConfigResponse,
    summary="Ver la configuración de la plataforma",
    description="Solo rol `admin`. Devuelve los parámetros ajustables en caliente.",
)
def ver_config(
    ajustes: ServicioAjustes = Depends(get_ajuste_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  return ajustes.obtener()


@router.put(
    "/admin/config",
    response_model=ConfigResponse,
    summary="Actualizar la configuración (solo admin)",
    description=(
        "Solo rol `admin`. Permite ajustar el factor mínimo de penalización por "
        "datos incompletos del inmueble y el boost aplicado a los inmuebles "
        "favoritos / 'me gusta' del inquilino. Se aplica al instante y se "
        "persiste."
    ),
)
def actualizar_config(
    datos: ConfigUpdate,
    ajustes: ServicioAjustes = Depends(get_ajuste_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  return ajustes.actualizar(
      penalizacion_completitud_min=datos.penalizacion_completitud_min,
      boost_feedback=datos.boost_feedback,
  )


@router.get(
    "/admin/usuarios",
    response_model=List[UsuarioResponse],
    summary="Listar los usuarios registrados (solo admin)",
    description="Solo rol `admin`. Devuelve todos los usuarios (sin contraseñas).",
)
def listar_usuarios(
    auth: ServicioAuth = Depends(get_auth_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  return auth.listar()


@router.put(
    "/admin/usuarios/{usuario_id}/rol",
    response_model=UsuarioResponse,
    summary="Cambiar el rol de un usuario (solo admin)",
    description=(
        "Solo rol `admin`. Cambia el rol de un usuario a uno de: `admin`, "
        "`prop_owner`, `real_estate_agent`, `seeker`. No permite cambiarse el "
        "rol a uno mismo (evita perder el acceso de administrador)."
    ),
)
def cambiar_rol_usuario(
    usuario_id: int,
    datos: RolUpdate,
    auth: ServicioAuth = Depends(get_auth_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  if usuario_id == usuario["id"]:
    raise HTTPException(status_code=400, detail="No podés cambiar tu propio rol")
  try:
    actualizado = auth.cambiar_rol(usuario_id, datos.rol)
  except ValueError as err:
    raise HTTPException(status_code=400, detail=str(err))
  if actualizado is None:
    raise HTTPException(
        status_code=404, detail="Usuario no encontrado: {0}".format(usuario_id)
    )
  return actualizado


@router.put(
    "/admin/usuarios/{usuario_id}/bloqueo",
    response_model=UsuarioResponse,
    summary="Bloquear o desbloquear un usuario (solo admin)",
    description=(
        "Solo rol `admin`. Un usuario bloqueado no puede iniciar sesión y sus "
        "sesiones activas dejan de funcionar. No permite bloquearse a uno mismo."
    ),
)
def bloquear_usuario(
    usuario_id: int,
    datos: BloqueoUpdate,
    auth: ServicioAuth = Depends(get_auth_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  if usuario_id == usuario["id"]:
    raise HTTPException(status_code=400, detail="No podés bloquear tu propio usuario")
  actualizado = auth.bloquear(usuario_id, datos.bloqueado)
  if actualizado is None:
    raise HTTPException(
        status_code=404, detail="Usuario no encontrado: {0}".format(usuario_id)
    )
  return actualizado


@router.delete(
    "/admin/usuarios/{usuario_id}",
    summary="Eliminar un usuario (solo admin)",
    description=(
        "Solo rol `admin`. Da de baja al usuario y revoca sus sesiones. No "
        "permite eliminarse a uno mismo."
    ),
)
def eliminar_usuario(
    usuario_id: int,
    auth: ServicioAuth = Depends(get_auth_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  if usuario_id == usuario["id"]:
    raise HTTPException(status_code=400, detail="No podés eliminar tu propio usuario")
  if not auth.eliminar(usuario_id):
    raise HTTPException(
        status_code=404, detail="Usuario no encontrado: {0}".format(usuario_id)
    )
  return {"status": "ok", "message": "Usuario eliminado"}


@router.get(
    "/admin/metricas",
    response_model=MetricasResponse,
    summary="Métricas de ranking (evaluación offline sintética)",
)
def ver_metricas(
    perfiles: int = Query(
        200,
        ge=10,
        le=1000,
        description="Perfiles sintéticos a generar para la evaluación",
    ),
    metricas: ServicioMetricas = Depends(get_metricas_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  """Compara los modelos contra un **oráculo sintético de utilidad latente**.

  No hay feedback real de usuarios: la relevancia se simula con pesos ocultos
  (distintos de los declarados) + ruido, y se reportan Precision@K, Recall@K,
  NDCG@K, MAP, MRR y Spearman por modelo. Evaluación sobre el **catálogo de
  trabajo** (lo que hoy ve la API). Solo `admin`.
  """
  return metricas.evaluar_catalogo(perfiles)


@router.get(
    "/admin/metricas/feedback",
    response_model=MetricasFeedbackResponse,
    summary="Métricas de ranking con feedback real (evaluación por usuario)",
    description=(
        "Compara los modelos usando el feedback real del inquilino como verdad: "
        "favorito / 'me gusta' = relevante y 'no me gusta' se excluye. Requiere "
        "usuarios con perfil guardado (se guarda al usar `/recommend`) y "
        "feedback. Solo `admin`."
    ),
)
def ver_metricas_feedback(
    metricas: ServicioMetricas = Depends(get_metricas_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  return metricas.evaluar_feedback()


@router.get(
    "/admin/feedback",
    response_model=List[FeedbackItem],
    summary="Todo el feedback registrado (solo admin)",
)
def listar_feedback_admin(
    feedback: ServicioFeedback = Depends(get_feedback_service),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN)),
):
  return [
      item_feedback(entrada, inmuebles)
      for entrada in feedback.listar_todos()
  ]
