import pytest

pytest.importorskip("lightgbm")

from src.config import FEATURE_COLS
from src.data_loader import load_mock_properties
from src.models.lgbm_model import (
    LGBMRecommender,
    N_GRADOS,
    generar_perfiles_sinteticos,
    grados_por_cuantiles,
)


def _perfil(**overrides):
  base = {
      "presupuesto_max": 300000,
      "moneda_preferida": "indistinta",
      "tiene_garantia_recibo": True,
      "tiene_garantia_prop": False,
      "tiene_mascota": False,
      "requiere_cochera": False,
      "prefiere_cochera": True,
      "hace_home_office": True,
      "nivel_tolerancia_ruido": "bajo",
      "frecuencia_lavado": "media",
      "hace_deporte": True,
      "lat_trabajo": -27.469,
      "lon_trabajo": -58.830,
      "distancia_max_trabajo_km": 5.0,
  }
  base.update(overrides)
  return base


def _recomendador_entrenado():
  rec = LGBMRecommender(feature_cols=FEATURE_COLS)
  rec._fit_cold_start(n_perfiles=60, seed=1)
  return rec


def test_generar_perfiles_sinteticos():
  perfiles = generar_perfiles_sinteticos(n_perfiles=10, seed=1)

  assert len(perfiles) == 10
  for perfil in perfiles:
    pesos = perfil["pesos_usuario"]
    assert set(pesos) == {
        "precio", "ubicacion", "habitos_confort", "amenities", "garantias"
    }
    assert abs(sum(pesos.values()) - 1.0) < 1e-6
    assert "presupuesto_max" in perfil
    assert "lat_trabajo" in perfil and "lon_trabajo" in perfil


def test_entrena_por_destilacion_y_predice():
  rec = _recomendador_entrenado()
  assert rec.is_trained

  resultado = rec.predict(load_mock_properties(), _perfil())

  assert not resultado.empty
  assert (resultado["score_compatibilidad"] >= 0).all()
  assert (resultado["score_compatibilidad"] <= 100).all()
  scores = resultado["score_compatibilidad"].tolist()
  assert scores == sorted(scores, reverse=True)


def test_importancia_de_variables():
  rec = _recomendador_entrenado()
  importancia = rec.get_feature_importance()

  assert set(importancia.columns) == {"feature", "importance"}
  assert set(rec.feature_names()).issubset(set(importancia["feature"]))


def test_grados_por_cuantiles_son_monotonos():
  scores = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0]
  grados = grados_por_cuantiles(scores)

  assert list(grados) == sorted(grados)
  assert grados[0] == 0
  assert grados[-1] == N_GRADOS - 1
  assert len(set(grados.tolist())) > 1


def test_grados_por_cuantiles_grupo_chico():
  assert grados_por_cuantiles([42.0]).tolist() == [0]
  assert grados_por_cuantiles([]).tolist() == []


def test_construir_dataset_devuelve_grupos_y_scores():
  rec = LGBMRecommender(feature_cols=FEATURE_COLS)
  perfiles = generar_perfiles_sinteticos(n_perfiles=8, seed=3)

  X, y, grupos, y_scores = rec.construir_dataset(
      perfiles, load_mock_properties()
  )

  assert X.shape[0] == len(y) == len(y_scores) == sum(grupos)
  assert X.shape[1] == len(rec.feature_names())
  assert (y >= 0).all() and (y <= N_GRADOS - 1).all()
  rec._fit_cold_start(n_perfiles=40, seed=3)
  assert rec.calibrador is not None
