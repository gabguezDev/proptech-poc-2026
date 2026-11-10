"""Evaluación offline de recomendadores con métricas de ranking.

Como no hay interacciones reales de usuarios, se construye un **oráculo
sintético** de relevancia ("utilidad latente"): por cada perfil se muestrean
pesos ocultos (distintos de los pesos declarados) y se agrega ruido. La utilidad
verdadera combina las features derivadas (`FEATURE_COLS`) normalizadas, de modo
que **ningún** modelo acierta perfecto y las métricas quedan en (0, 1), lo que
permite comparar modelos de forma justa.

Métricas: Precision@K, Recall@K, NDCG@K, MAP, MRR y Spearman (modelo vs.
utilidad verdadera). Ver `src/metrics.py`.

⚠️ Es una evaluación **sintética**: mide coherencia con el oráculo, no con
usuarios reales (limitación documentada del PoC).
"""

import numpy as np
import pandas as pd

from src.config import FEATURE_COLS, LGBM_MODEL_PATH
from src.feedback_tipos import GRADO_FEEDBACK, GRADO_RELEVANTE, TIPO_NO_ME_GUSTA
from src.metrics import (
    average_precision,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
    spearman,
)
from src.models.content_model import ContentRecommender

FEATURES_MENOR_MEJOR = ("distancia_trabajo",)
RUIDO_UTILIDAD = 0.08


def _normalizar(df_features: pd.DataFrame, columnas) -> pd.DataFrame:
  """Normaliza cada feature a [0, 1] por min-max dentro del conjunto candidato.

  Invierte (`1 - x`) las features donde "menor es mejor".
  """
  normalizado = pd.DataFrame(index=df_features.index)
  for columna in columnas:
    serie = pd.to_numeric(df_features[columna], errors="coerce")
    minimo, maximo = serie.min(), serie.max()
    if pd.notna(minimo) and pd.notna(maximo) and maximo > minimo:
      valores = ((serie - minimo) / (maximo - minimo)).fillna(0.0)
    else:
      valores = pd.Series(0.0, index=df_features.index)
    if columna in FEATURES_MENOR_MEJOR:
      valores = 1.0 - valores
    normalizado[columna] = valores
  return normalizado


def utilidad_latente(df_features: pd.DataFrame, seed: int) -> np.ndarray:
  """Utilidad verdadera (0-1) de cada inmueble para un perfil.

  Pesos ocultos (Dirichlet) sobre las features normalizadas + ruido por
  inmueble. El ruido se siembra por `id_inmueble`, así el oráculo es
  **independiente del orden** en que el modelo devuelve los inmuebles.
  """
  pesos = np.random.default_rng(seed).dirichlet(np.ones(len(FEATURE_COLS)))
  base = _normalizar(df_features, FEATURE_COLS).to_numpy() @ pesos

  if "id_inmueble" in df_features.columns:
    ruido = np.array([
        np.random.default_rng([seed, int(id_)]).normal(0.0, RUIDO_UTILIDAD)
        for id_ in df_features["id_inmueble"]
    ])
  else:
    ruido = np.random.default_rng(seed).normal(
        0.0, RUIDO_UTILIDAD, size=base.size
    )
  return np.clip(base + ruido, 0.0, 1.0)


def relevancia_binaria(utilidad: np.ndarray, prop_relevantes: float) -> np.ndarray:
  """Marca como relevantes el top `prop_relevantes` de la utilidad."""
  umbral = np.quantile(utilidad, 1.0 - prop_relevantes)
  return (utilidad >= umbral).astype(int)


def _media(valores) -> float:
  """Promedio ignorando `nan`. Lista vacía -> 0.0."""
  limpios = [v for v in valores if not np.isnan(v)]
  return float(np.mean(limpios)) if limpios else 0.0


def evaluar_recomendador(
    recommender,
    df_properties: pd.DataFrame,
    perfiles: list,
    k_values=(5, 10),
    prop_relevantes: float = 0.3,
    seed: int = 1234,
) -> dict:
  """Evalúa un recomendador (con `predict(df, perfil)`) y promedia las métricas.

  Devuelve un dict con el promedio por K (precision/recall/ndcg) y las métricas
  globales (map/mrr/spearman).
  """
  por_k = {k: {"precision": [], "recall": [], "ndcg": []} for k in k_values}
  maps, mrrs, correlaciones = [], [], []
  perfiles_usados = 0

  for indice, perfil in enumerate(perfiles):
    ranking = recommender.predict(df_properties, perfil)
    if ranking is None or len(ranking) < 2:
      continue

    utilidad = utilidad_latente(ranking, seed + indice)
    binaria = relevancia_binaria(utilidad, prop_relevantes)
    total_relevantes = int(binaria.sum())
    if total_relevantes == 0:
      continue

    perfiles_usados += 1
    maps.append(average_precision(binaria))
    mrrs.append(reciprocal_rank(binaria))
    correlaciones.append(
        spearman(ranking["score_compatibilidad"].to_numpy(), utilidad)
    )

    for k in k_values:
      por_k[k]["precision"].append(precision_at_k(binaria, k))
      por_k[k]["recall"].append(recall_at_k(binaria, k, total_relevantes))
      por_k[k]["ndcg"].append(ndcg_at_k(utilidad, k))

  return {
      "perfiles": perfiles_usados,
      "por_k": [
          {
              "k": k,
              "precision": _media(por_k[k]["precision"]),
              "recall": _media(por_k[k]["recall"]),
              "ndcg": _media(por_k[k]["ndcg"]),
          }
          for k in k_values
      ],
      "map": _media(maps),
      "mrr": _media(mrrs),
      "spearman": _media(correlaciones),
  }


def construir_content() -> ContentRecommender:
  return ContentRecommender(feature_cols=FEATURE_COLS)


def construir_lgbm():
  """Construye el LGBMRecommender (import perezoso: requiere `lightgbm`)."""
  from src.models.lgbm_model import LGBMRecommender

  recommender = LGBMRecommender(feature_cols=FEATURE_COLS)
  if LGBM_MODEL_PATH.exists():
    recommender.load(LGBM_MODEL_PATH)
  else:
    recommender._fit_cold_start()
  return recommender


def comparar_modelos(
    df_properties: pd.DataFrame,
    perfiles: list,
    k_values=(5, 10),
    prop_relevantes: float = 0.3,
    seed: int = 1234,
) -> list:
  """Evalúa Content vs LGBM contra el mismo oráculo y devuelve la comparación."""
  recomendadores = [
      ("ContentRecommender", construir_content()),
      ("LGBMRecommender", construir_lgbm()),
  ]
  resultados = []
  for nombre, recommender in recomendadores:
    metricas = evaluar_recomendador(
        recommender, df_properties, perfiles, k_values, prop_relevantes, seed
    )
    metricas["modelo"] = nombre
    resultados.append(metricas)
  return resultados


def _grados_del_mapa(mapa: dict) -> dict:
  """{id_inmueble: grado} a partir de {id_inmueble: [tipos]}."""
  grados = {}
  for id_inmueble, tipos in mapa.items():
    grados[id_inmueble] = max(
        (GRADO_FEEDBACK.get(tipo, 0.0) for tipo in tipos), default=0.0
    )
  return grados


def construir_casos_feedback(store) -> list:
  """Casos de evaluación a partir del feedback real y los perfiles guardados.

  Cada caso es `{perfil, grados, excluir}`. Solo se incluyen los usuarios que
  tienen **perfil guardado y feedback**.
  """
  casos = []
  for email, perfil in store.listar_perfiles().items():
    mapa = store.mapa_usuario(email)
    if not mapa:
      continue
    perfil_limpio = {k: v for k, v in perfil.items() if k != "actualizado"}
    casos.append({
        "perfil": perfil_limpio,
        "grados": _grados_del_mapa(mapa),
        "excluir": {
            id_ for id_, tipos in mapa.items() if TIPO_NO_ME_GUSTA in tipos
        },
    })
  return casos


def evaluar_recomendador_feedback(
    recommender,
    df_properties: pd.DataFrame,
    casos: list,
    k_values=(5, 10),
) -> dict:
  """Evalúa un recomendador con la relevancia derivada del feedback real.

  Excluye los inmuebles con `no_me_gusta` (igual que en producción) y mide la
  calidad del ranking contra el feedback de cada usuario. Relevancia binaria:
  favorito / me_gusta (grado >= `GRADO_RELEVANTE`).
  """
  por_k = {k: {"precision": [], "recall": [], "ndcg": []} for k in k_values}
  maps, mrrs, correlaciones = [], [], []
  usuarios_usados = 0

  for caso in casos:
    ranking = recommender.predict(df_properties, caso["perfil"])
    if ranking is None or len(ranking) < 2:
      continue

    excluir = caso["excluir"]
    if excluir:
      ranking = ranking[~ranking["id_inmueble"].isin(excluir)]
    if len(ranking) < 2:
      continue

    grados = caso["grados"]
    relevancia = ranking["id_inmueble"].map(
        lambda id_: grados.get(int(id_), 0.0)
    ).to_numpy(dtype=float)
    binaria = (relevancia >= GRADO_RELEVANTE).astype(int)
    total_relevantes = int(binaria.sum())
    if total_relevantes == 0:
      continue

    usuarios_usados += 1
    maps.append(average_precision(binaria))
    mrrs.append(reciprocal_rank(binaria))
    correlaciones.append(
        spearman(ranking["score_compatibilidad"].to_numpy(), relevancia)
    )
    for k in k_values:
      por_k[k]["precision"].append(precision_at_k(binaria, k))
      por_k[k]["recall"].append(recall_at_k(binaria, k, total_relevantes))
      por_k[k]["ndcg"].append(ndcg_at_k(relevancia, k))

  return {
      "perfiles": usuarios_usados,
      "por_k": [
          {
              "k": k,
              "precision": _media(por_k[k]["precision"]),
              "recall": _media(por_k[k]["recall"]),
              "ndcg": _media(por_k[k]["ndcg"]),
          }
          for k in k_values
      ],
      "map": _media(maps),
      "mrr": _media(mrrs),
      "spearman": _media(correlaciones),
  }


def comparar_modelos_feedback(
    df_properties: pd.DataFrame,
    store,
    k_values=(5, 10),
) -> list:
  """Evalúa Content vs LGBM con el feedback real como ground truth."""
  casos = construir_casos_feedback(store)
  recomendadores = [
      ("ContentRecommender", construir_content()),
      ("LGBMRecommender", construir_lgbm()),
  ]
  resultados = []
  for nombre, recommender in recomendadores:
    metricas = evaluar_recomendador_feedback(
        recommender, df_properties, casos, k_values
    )
    metricas["modelo"] = nombre
    resultados.append(metricas)
  return resultados
