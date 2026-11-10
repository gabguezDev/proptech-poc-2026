"""Controlador de recomendaciones: ranking para un perfil de inquilino.

Lo usan tanto el inquilino (`seeker`) como el administrador (`admin`), que lo
aprovecha para simular perfiles diversos y ver qué recomendaciones arroja.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencias import get_recomendacion_service, requiere_roles
from app.core.seguridad import ROL_ADMIN, ROL_SEEKER
from app.schemas.recomendacion import RecommendResponse, UserPreferences
from app.services.recomendacion_service import ServicioRecomendacion
from src.config import DEFAULT_TOP_K

router = APIRouter(tags=["Usuario"])


@router.post(
    "/recommend",
    response_model=RecommendResponse,
    summary="Recomendar inmuebles a partir del perfil del usuario",
    description=(
        "Recibe el perfil completo del inquilino (campos solicitados al "
        "usuario), aplica filtros duros, calcula features de compatibilidad y "
        "devuelve el ranking de inmuebles (campos de la propiedad) con su "
        "`score_compatibilidad` (0-100). Excluye los inmuebles que el inquilino "
        "marcó como 'no me gusta' y aplica un boost a sus favoritos / 'me "
        "gusta'. Cada resultado incluye `feedback` con lo ya registrado. "
        "El administrador puede usarlo para simular perfiles."
    ),
)
def recommend_properties(
    preferences: UserPreferences,
    top_k: int = DEFAULT_TOP_K,
    servicio: ServicioRecomendacion = Depends(get_recomendacion_service),
    usuario: dict = Depends(requiere_roles(ROL_SEEKER, ROL_ADMIN)),
):
  try:
    perfil = preferences.model_dump()
    registros = servicio.recomendar(usuario["email"], perfil, top_k)
    return {"count": len(registros), "results": registros}
  except FileNotFoundError as fnf_err:
    raise HTTPException(status_code=404, detail=str(fnf_err))
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
