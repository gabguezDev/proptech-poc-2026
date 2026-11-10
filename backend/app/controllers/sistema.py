"""Controlador del sistema: salud del servicio."""

from fastapi import APIRouter

from app.services.recomendacion_service import obtener_recommender

router = APIRouter(tags=["Sistema"])


@router.get("/")
def health_check():
  return {
      "status": "ok",
      "message": "API de recomendación activa",
      "modelo": type(obtener_recommender()).__name__,
  }
