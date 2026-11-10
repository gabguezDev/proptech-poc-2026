"""Entrenamiento del LGBMRecommender (LGBMRanker) por destilación del maestro.

Como no hay feedback real de usuarios, el `ContentRecommender` actúa como
*maestro*: a partir de perfiles de usuario simulados se genera un
`score_compatibilidad` (0-100). Esos scores se convierten en **grados de
relevancia** (por cuantiles dentro de cada perfil) y el `LGBMRanker` aprende a
**ordenar** el catálogo imitando al maestro. Una **regresión isotónica** ajusta
el puntaje crudo del ranker a la escala 0-100 del maestro.

Uso:
    venv/bin/python -m src.train_lgbm

Salidas:
    - artifacts/lgbm_recommender.pkl   (ranker + calibrador)
    - Impresión en consola de métricas (Spearman, MAE) e importancia de variables.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import ARTIFACTS_DIR, FEATURE_COLS, LGBM_MODEL_PATH
from src.data_loader import load_mock_properties
from src.models.lgbm_model import LGBMRecommender, generar_perfiles_sinteticos


def evaluar(recommender: LGBMRecommender, df, perfiles):
  """Compara el ranker (calibrado) contra el maestro: Spearman medio y MAE medio."""
  content = recommender.content_model
  correlaciones, errores = [], []

  for perfil in perfiles:
    ranked = content.predict(df, perfil)
    if len(ranked) < 2:
      continue

    X = recommender._matriz_features(ranked, perfil)
    pred = recommender._scores(X)
    real = ranked["score_compatibilidad"].to_numpy()

    correlaciones.append(
        pd.Series(pred).corr(pd.Series(real), method="spearman")
    )
    errores.append(np.abs(pred - real).mean())

  return float(np.mean(correlaciones)), float(np.mean(errores))


def main():
  print("=" * 60)
  print(" Entrenamiento del LGBMRecommender (LGBMRanker, destilación)")
  print("=" * 60)

  df = load_mock_properties()

  perfiles = generar_perfiles_sinteticos(n_perfiles=400, seed=7)
  corte = int(len(perfiles) * 0.8)
  perfiles_train = perfiles[:corte]
  perfiles_test = perfiles[corte:]
  print("Perfiles generados: {0} (train: {1} / test: {2})".format(
      len(perfiles), len(perfiles_train), len(perfiles_test)))

  recommender = LGBMRecommender(feature_cols=FEATURE_COLS)
  X_train, y_train, grupos, y_scores = recommender.construir_dataset(perfiles_train, df)
  print("Filas de entrenamiento: {0} x {1} features".format(
      X_train.shape[0], X_train.shape[1]))
  print("Grupos (perfiles con >= 2 candidatos): {0}".format(len(grupos)))

  recommender.train(X_train, y_train, grupos)
  recommender.calibrar(X_train, y_scores)
  print("Modelo entrenado: {0} árboles (objetivo lambdarank)".format(
      recommender.model.n_estimators))

  spearman, mae = evaluar(recommender, df, perfiles_test)
  print("-" * 60)
  print("Métricas en test (modelo vs. maestro):")
  print("  Spearman (orden)         : {0:.4f}".format(spearman))
  print("  MAE (score 0-100)        : {0:.2f}".format(mae))

  print("-" * 60)
  print("Top 10 variables más importantes:")
  importancia = recommender.get_feature_importance().head(10)
  for _, fila in importancia.iterrows():
    print("  {0:<28} {1}".format(fila["feature"], fila["importance"]))

  ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
  recommender.save(LGBM_MODEL_PATH)
  print("-" * 60)
  print("Modelo guardado en: {0}".format(LGBM_MODEL_PATH))
  print("=" * 60)


if __name__ == "__main__":
  main()
