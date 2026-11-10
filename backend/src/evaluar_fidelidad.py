"""Evaluación de **fidelidad** del alumno (LGBMRanker) respecto del maestro.

Complementa a `src.evaluar_modelos` (que mide contra el oráculo sintético de
utilidad latente). Este script mide otra cosa: cuán fiel es el ordenamiento del
ranker destilado al del `ContentRecommender` que lo etiquetó. Usa los **mismos
perfiles sintéticos y la misma semilla** de la evaluación con oráculo, para que
ambas tablas del documento sean comparables.

Métricas (promedio sobre los perfiles con >= 2 candidatos):
  - Spearman medio: concordancia del orden completo.
  - Kendall tau medio: concordancia por pares.
  - Superposición media en Top-K: fracción de los K mejores del maestro que el
    alumno recupera entre sus K mejores.
  - Desplazamiento medio: diferencia media de posición, en puestos.

Uso:
    venv/bin/python -m src.evaluar_fidelidad

Salidas:
    - Impresión en consola de la tabla de fidelidad.
    - artifacts/metricas_fidelidad.json   (resultados crudos)
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import ARTIFACTS_DIR, LGBM_MODEL_PATH
from src.data_loader import load_mock_properties
from src.evaluacion import construir_content, construir_lgbm
from src.models.lgbm_model import generar_perfiles_sinteticos

N_PERFILES = 200
K_SUPERPUESTO = 5
SEED = 1234


def medir_fidelidad(df, perfiles, maestro, alumno, k: int = K_SUPERPUESTO) -> dict:
  """Promedios de concordancia entre el orden del alumno y el del maestro."""
  spearman, kendall, superposiciones, desplazamientos = [], [], [], []

  for perfil in perfiles:
    r_maestro = maestro.predict(df, perfil)
    r_alumno = alumno.predict(df, perfil)
    if len(r_maestro) < 2 or len(r_alumno) < 2:
      continue

    ids_maestro = list(r_maestro["id_inmueble"])
    ids_alumno = list(r_alumno["id_inmueble"])
    if set(ids_maestro) != set(ids_alumno):
      continue

    orden_maestro = list(range(len(ids_maestro)))
    orden_alumno = [ids_alumno.index(id_inmueble) for id_inmueble in ids_maestro]

    serie_maestro = pd.Series(orden_maestro)
    serie_alumno = pd.Series(orden_alumno)
    spearman.append(float(serie_maestro.corr(serie_alumno, method="spearman")))
    kendall.append(float(serie_maestro.corr(serie_alumno, method="kendall")))

    efectivo = min(k, len(ids_maestro))
    recuperadas = len(set(ids_maestro[:efectivo]) & set(ids_alumno[:efectivo]))
    superposiciones.append(recuperadas / efectivo)
    desplazamientos.append(
        float(np.mean(np.abs(np.array(orden_alumno) - np.array(orden_maestro))))
    )

  return {
      "perfiles_evaluados": len(spearman),
      "spearman": float(np.mean(spearman)),
      "kendall": float(np.mean(kendall)),
      "superposicion_top_k": float(np.mean(superposiciones)),
      "desplazamiento_medio": float(np.mean(desplazamientos)),
  }


def main():
  print("=" * 66)
  print(" Fidelidad del alumno (LGBMRanker) respecto del maestro")
  print("=" * 66)

  df = load_mock_properties()
  perfiles = generar_perfiles_sinteticos(n_perfiles=N_PERFILES, seed=SEED)
  maestro = construir_content()
  alumno = construir_lgbm()

  resultado = medir_fidelidad(df, perfiles, maestro, alumno)

  print("Semilla: {0} | Inmuebles (semilla): {1} | Perfiles comparables: {2}".format(
      SEED, len(df), resultado["perfiles_evaluados"]))
  print("-" * 66)
  print("  Spearman medio (orden completo)  : {0:.4f}".format(resultado["spearman"]))
  print("  Kendall tau medio (por pares)    : {0:.4f}".format(resultado["kendall"]))
  print("  Superposición media en Top-{0}     : {1:.4f}".format(
      K_SUPERPUESTO, resultado["superposicion_top_k"]))
  print("  Desplazamiento medio (puestos)   : {0:.4f}".format(
      resultado["desplazamiento_medio"]))
  print("-" * 66)
  print("Modelo activo: {0}".format(LGBM_MODEL_PATH))
  print("=" * 66)

  ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
  salida = ARTIFACTS_DIR / "metricas_fidelidad.json"
  with open(salida, "w", encoding="utf-8") as archivo:
    json.dump(
        {
            "perfiles": N_PERFILES,
            "inmuebles": len(df),
            "k": K_SUPERPUESTO,
            "seed": SEED,
            "resultado": resultado,
        },
        archivo, ensure_ascii=False, indent=2,
    )
  print("Resultados guardados en: {0}".format(salida))


if __name__ == "__main__":
  main()
