"""Controlador del feedback del inquilino (lado demanda y lado oferta)."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencias import (
    get_feedback_service,
    get_inmueble_service,
    requiere_roles,
)
from app.core.seguridad import ROL_ADMIN, ROL_AGENTE, ROL_PROPIETARIO, ROL_SEEKER
from src.feedback_tipos import TIPO_VISITA_CONFIRMADA
from app.schemas.feedback import (
    FeedbackItem,
    FeedbackRequest,
    FeedbackResumenResponse,
)
from app.services.feedback_service import ServicioFeedback
from app.services.inmueble_service import ServicioInmuebles
from app.utils.presentacion import item_feedback

router = APIRouter(tags=["Feedback"])


@router.get(
    "/mi-perfil",
    summary="Último perfil consultado del inquilino (para editarlo)",
    description=(
        "Devuelve el último perfil que el usuario envió a `/recommend` "
        "(`null` si nunca consultó). Lo usa la pantalla de edición de perfil."
    ),
)
def mi_perfil(
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(ROL_SEEKER, ROL_ADMIN)),
):
  perfil = feedback.obtener_perfil(usuario["email"])
  return {"perfil": perfil}


@router.post(
    "/feedback",
    response_model=FeedbackItem,
    status_code=201,
    summary="Registrar feedback del inquilino (favorito / reacción / interacción)",
    description=(
        "Registra o actualiza el feedback del inquilino sobre un inmueble. "
        "`me_gusta` y `no_me_gusta` son mutuamente excluyentes; las interacciones "
        "(`visto`, `contacto`, `visita_solicitada`) acumulan repeticiones. Los "
        "`no_me_gusta` se excluyen del ranking y los favoritos / `me_gusta` "
        "reciben un boost (configurable por el admin)."
    ),
)
def registrar_feedback(
    datos: FeedbackRequest,
    feedback: ServicioFeedback = Depends(get_feedback_service),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(ROL_SEEKER, ROL_ADMIN)),
):
  if inmuebles.obtener(datos.id_inmueble) is None:
    raise HTTPException(
        status_code=404,
        detail="Inmueble no encontrado: {0}".format(datos.id_inmueble),
    )
  try:
    entrada = feedback.registrar(
        usuario["email"], datos.id_inmueble, datos.tipo, datos.detalle
    )
  except ValueError as err:
    raise HTTPException(status_code=400, detail=str(err))
  return item_feedback(entrada, inmuebles)


@router.get(
    "/mis-feedback",
    response_model=List[FeedbackItem],
    summary="Feedback del inquilino (incluye los 'no me gusta')",
    description=(
        "Lista el feedback del usuario autenticado con el resumen de cada "
        "inmueble. Con `?tipo=no_me_gusta` es la zona donde el inquilino ve las "
        "publicaciones que descartó; se revierten con `DELETE /feedback/{id}`."
    ),
)
def mis_feedback(
    tipo: Optional[str] = Query(None, description="Filtrar por tipo de feedback"),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(ROL_SEEKER, ROL_ADMIN)),
):
  entradas = feedback.listar_usuario(usuario["email"], tipo)
  return [item_feedback(entrada, inmuebles) for entrada in entradas]


@router.delete(
    "/feedback/{id_inmueble}",
    summary="Revertir el feedback de un inmueble",
    description=(
        "Quita el feedback del usuario sobre un inmueble. Si se indica `?tipo=`, "
        "quita solo ese; si no, quita todo. Devuelve cuántas entradas quitó."
    ),
)
def revertir_feedback(
    id_inmueble: int,
    tipo: Optional[str] = Query(None, description="Tipo a quitar (opcional)"),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(ROL_SEEKER, ROL_ADMIN)),
):
  quitados = feedback.eliminar(usuario["email"], id_inmueble, tipo)
  if quitados == 0:
    raise HTTPException(
        status_code=404,
        detail="No tenías feedback sobre el inmueble {0}".format(id_inmueble),
    )
  return {"status": "ok", "quitados": quitados}


@router.get(
    "/feedback/inmueble/{id_inmueble}",
    response_model=FeedbackResumenResponse,
    summary="Resumen de feedback de un inmueble (lado oferta)",
    description=(
        "Cuántos favoritos, 'me gusta', 'no me gusta', vistas, contactos y "
        "solicitudes de visita acumuló un inmueble. Solo quien lo gestiona (o un "
        "`admin`)."
    ),
)
def resumen_feedback_inmueble(
    id_inmueble: int,
    feedback: ServicioFeedback = Depends(get_feedback_service),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(ROL_ADMIN, ROL_PROPIETARIO, ROL_AGENTE)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404,
        detail="Inmueble no encontrado: {0}".format(id_inmueble),
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403,
        detail="No gestionás el inmueble {0}".format(id_inmueble),
    )
  resumen = feedback.resumen_inmueble(id_inmueble)
  return {
      "id_inmueble": id_inmueble,
      "total": sum(resumen.values()),
      "por_tipo": [
          {"tipo": tipo, "cantidad": cantidad}
          for tipo, cantidad in resumen.items()
      ],
  }
