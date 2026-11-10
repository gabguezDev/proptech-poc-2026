"""Esquemas Pydantic del feedback del inquilino."""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.inmueble import Inmueble

class FeedbackRequest(BaseModel):
  """Alta de feedback del inquilino sobre un inmueble."""

  model_config = ConfigDict(
      json_schema_extra={"example": {"id_inmueble": 101, "tipo": "favorito"}}
  )

  id_inmueble: int = Field(..., description="Inmueble sobre el que se opina")
  tipo: str = Field(
      ...,
      description="Tipo de feedback: favorito / me_gusta / no_me_gusta / visto / "
      "contacto / visita_solicitada / vio / no_vio / no_se",
  )
  detalle: Optional[str] = Field(
      None,
      description="Afirmación verificada (p. ej. 'distancia_hospital_m') "
      "para vio / no_vio / no_se",
  )


class FeedbackItem(BaseModel):
  """Entrada de feedback del inquilino, con el resumen del inmueble."""

  id: int = Field(..., description="Identificador de la entrada de feedback")
  id_inmueble: int = Field(..., description="Inmueble referenciado")
  tipo: str = Field(..., description="Tipo de feedback")
  detalle: Optional[str] = Field(
      None, description="Afirmación verificada (vio / no_vio / no_se)"
  )
  repeticiones: int = Field(..., description="Cantidad de veces registrado")
  creado: float = Field(..., description="Marca de tiempo de creación")
  actualizado: float = Field(..., description="Marca de tiempo de actualización")
  inmueble: Optional[Inmueble] = Field(
      None, description="Resumen del inmueble (para mostrar la tarjeta)"
  )


class FeedbackResumenItem(BaseModel):
  """Conteo de feedback de un inmueble (lado oferta)."""

  tipo: str = Field(..., description="Tipo de feedback")
  cantidad: int = Field(..., description="Cantidad de entradas de ese tipo")


class FeedbackResumenResponse(BaseModel):
  """Resumen de feedback de un inmueble gestionado por el usuario."""

  id_inmueble: int = Field(..., description="Identificador del inmueble")
  total: int = Field(..., description="Total de entradas de feedback")
  por_tipo: List[FeedbackResumenItem] = Field(
      ..., description="Conteo por tipo de feedback"
  )
