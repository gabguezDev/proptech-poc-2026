"""Evaluación offline de los recomendadores con métricas de ranking.

Genera perfiles sintéticos, construye un **oráculo de utilidad latente** (pesos
ocultos + ruido) y mide Precision@K, Recall@K, NDCG@K, MAP, MRR y Spearman para
cada modelo (ContentRecommender vs LGBMRecommender). No hay feedback real: es una
evaluación **sintética** (ver `src/evaluacion.py`).

Uso:
    venv/bin/python -m src.evaluar_modelos

Salidas:
    - Impresión en consola de la tabla comparativa.
    - artifacts/metricas_ranking.json   (resultados crudos)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import ARTIFACTS_DIR
from src.data_loader import load_mock_properties
from src.evaluacion import comparar_modelos
from src.models.lgbm_model import generar_perfiles_sinteticos

N_PERFILES = 200
K_VALUES = (5, 10)
PROP_RELEVANTES = 0.3
SEED = 1234


def main():
  print("=" * 72)
  print(" Evaluación de ranking (offline, sintética)")
  print("=" * 72)

  df = load_mock_properties()
  perfiles = generar_perfiles_sinteticos(n_perfiles=N_PERFILES, seed=SEED)
  print("Perfiles: {0} | Inmuebles (semilla): {1} | K = {2}".format(
      len(perfiles), len(df), list(K_VALUES)))
  print("Relevancia: top {0:.0%} de la utilidad latente (oráculo sintético).".format(
      PROP_RELEVANTES))

  resultados = comparar_modelos(
      df, perfiles, k_values=K_VALUES,
      prop_relevantes=PROP_RELEVANTES, seed=SEED,
  )

  print("-" * 72)
  print("{0:<20} {1:>4} {2:>10} {3:>10} {4:>10}".format(
      "Modelo", "K", "Prec@K", "Rec@K", "NDCG@K"))
  for resultado in resultados:
    for fila in resultado["por_k"]:
      print("{0:<20} {1:>4} {2:>10.4f} {3:>10.4f} {4:>10.4f}".format(
          resultado["modelo"], fila["k"], fila["precision"],
          fila["recall"], fila["ndcg"]))

  print("-" * 72)
  print("{0:<20} {1:>10} {2:>10} {3:>10}".format(
      "Modelo", "MAP", "MRR", "Spearman"))
  for resultado in resultados:
    print("{0:<20} {1:>10.4f} {2:>10.4f} {3:>10.4f}".format(
        resultado["modelo"], resultado["map"], resultado["mrr"],
        resultado["spearman"]))

  ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
  salida = ARTIFACTS_DIR / "metricas_ranking.json"
  with open(salida, "w", encoding="utf-8") as archivo:
    json.dump(
        {
            "perfiles": len(perfiles),
            "inmuebles": len(df),
            "k_values": list(K_VALUES),
            "prop_relevantes": PROP_RELEVANTES,
            "seed": SEED,
            "resultados": resultados,
        },
        archivo, ensure_ascii=False, indent=2,
    )
  print("-" * 72)
  print("Resultados guardados en: {0}".format(salida))
  print("=" * 72)


if __name__ == "__main__":
  main()
