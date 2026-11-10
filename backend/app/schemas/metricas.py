"""Esquemas Pydantic (contrato HTTP) de evaluación de ranking."""

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, create_model

class MetricasK(BaseModel):
  """Métricas que dependen del corte K."""

  k: int = Field(..., description="Corte K del ranking")
  precision: float = Field(..., description="Precision@K")
  recall: float = Field(..., description="Recall@K")
  ndcg: float = Field(..., description="NDCG@K (ganancia graduada)")


class MetricasModelo(BaseModel):
  """Métricas agregadas de un modelo sobre el conjunto de perfiles."""

  modelo: str = Field(..., description="Nombre del recomendador evaluado")
  perfiles: int = Field(..., description="Perfiles efectivamente evaluados")
  por_k: List[MetricasK] = Field(..., description="Métricas por corte K")
  map: float = Field(..., description="Mean Average Precision (MAP)")
  mrr: float = Field(..., description="Mean Reciprocal Rank (MRR)")
  spearman: float = Field(
      ..., description="Spearman entre el score del modelo y la utilidad latente"
  )


class MetricasResponse(BaseModel):
  """Comparación de modelos contra el oráculo sintético de utilidad latente."""

  perfiles_solicitados: int = Field(..., description="Perfiles sintéticos generados")
  prop_relevantes: float = Field(
      ..., description="Fracción de inmuebles marcada como relevante (top-q)"
  )
  seed: int = Field(..., description="Semilla del oráculo (reproducibilidad)")
  resultados: List[MetricasModelo] = Field(
      ..., description="Métricas por modelo"
  )


class MetricasFeedbackResponse(BaseModel):
  """Comparación de modelos usando el feedback real del inquilino como verdad."""

  usuarios: int = Field(
      ..., description="Usuarios con perfil y feedback evaluados"
  )
  resultados: List[MetricasModelo] = Field(
      ..., description="Métricas por modelo (el campo `perfiles` = usuarios)"
  )
