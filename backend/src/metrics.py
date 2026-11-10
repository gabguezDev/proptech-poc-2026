"""Métricas de evaluación de ranking (offline).

Funciones puras sobre una lista de relevancias **en el orden en que el modelo
las devolvió** (rank 1 primero). Para métricas binarias (Precision, Recall, MAP,
MRR) la relevancia es 0/1; para NDCG puede ser graduada (un número real >= 0).

Se usan en `src/evaluacion.py` para comparar recomendadores contra un oráculo
sintético (no hay feedback real de usuarios).
"""

import numpy as np
import pandas as pd


def _a_array(relevancia) -> np.ndarray:
  return np.asarray(relevancia, dtype=float)


def precision_at_k(relevancia, k: int) -> float:
  """Proporción de ítems relevantes entre los primeros `k` (relevancia binaria)."""
  corte = _a_array(relevancia)[:k]
  if corte.size == 0:
    return 0.0
  return float(np.mean(corte > 0))


def recall_at_k(relevancia, k: int, total_relevantes: int) -> float:
  """Proporción de los relevantes totales que aparecen en los primeros `k`."""
  if total_relevantes <= 0:
    return 0.0
  corte = _a_array(relevancia)[:k]
  return float(np.sum(corte > 0) / total_relevantes)


def _dcg(relevancia, k: int) -> float:
  """Discounted Cumulative Gain con ganancias exponenciales (2^rel - 1)."""
  corte = _a_array(relevancia)[:k]
  if corte.size == 0:
    return 0.0
  ganancias = np.power(2.0, corte) - 1.0
  descuentos = np.log2(np.arange(2, corte.size + 2))
  return float(np.sum(ganancias / descuentos))


def ndcg_at_k(relevancia, k: int) -> float:
  """Normalized DCG@k: DCG@k del ranking sobre el DCG@k ideal (relevancia graduada)."""
  relevancia = _a_array(relevancia)
  ideal = np.sort(relevancia)[::-1]
  idcg = _dcg(ideal, k)
  if idcg == 0.0:
    return 0.0
  return _dcg(relevancia, k) / idcg


def average_precision(relevancia) -> float:
  """Average Precision (AP): área bajo la curva Precision-Recall de un ranking."""
  relevancia = _a_array(relevancia)
  total_relevantes = int(np.sum(relevancia > 0))
  if total_relevantes == 0:
    return 0.0
  aciertos = 0
  acumulado = 0.0
  for posicion, rel in enumerate(relevancia, start=1):
    if rel > 0:
      aciertos += 1
      acumulado += aciertos / posicion
  return float(acumulado / total_relevantes)


def reciprocal_rank(relevancia) -> float:
  """Reciprocal Rank (RR): 1 / posición del primer ítem relevante."""
  relevancia = _a_array(relevancia)
  posiciones = np.where(relevancia > 0)[0]
  if posiciones.size == 0:
    return 0.0
  return float(1.0 / (posiciones[0] + 1))


def spearman(x, y) -> float:
  """Correlación de Spearman entre dos rankings/series (nan si hay < 2 datos)."""
  x = _a_array(x)
  y = _a_array(y)
  if x.size < 2 or y.size < 2:
    return float("nan")
  return float(
      pd.Series(x).corr(pd.Series(y), method="spearman")
  )
