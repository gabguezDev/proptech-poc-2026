import numpy as np
import pandas as pd

from src.config import FEATURE_COLS
from src.data_loader import load_mock_properties
from src.evaluacion import (
    construir_casos_feedback,
    construir_content,
    evaluar_recomendador,
    evaluar_recomendador_feedback,
    relevancia_binaria,
    utilidad_latente,
)
from app.repositories.feedback_repository import RepositorioFeedback
from app.services.feedback_service import ServicioFeedback
from src.feedback_tipos import TIPO_FAVORITO, TIPO_NO_ME_GUSTA, TIPO_VISTO


def _perfil():
  return {
      "presupuesto_max": 300000,
      "tiene_mascota": True,
      "requiere_cochera": False,
      "prefiere_cochera": True,
      "hace_home_office": True,
      "nivel_tolerancia_ruido": "bajo",
      "frecuencia_lavado": "media",
      "lat_trabajo": -27.469,
      "lon_trabajo": -58.830,
      "distancia_max_trabajo_km": 50.0,
      "pesos_usuario": {
          "precio": 0.35,
          "ubicacion": 0.30,
          "habitos_confort": 0.20,
          "amenities": 0.15,
      },
  }


def _df_features():
  filas = [
      {"id_inmueble": 1, "distancia_trabajo": 1.0, "margen_presupuesto": 50000,
       "match_cochera": 1, "tiene_balcon": 1, "es_silencioso": 1,
       "proximidad_salud": 0.8, "proximidad_verde": 0.5, "match_garantia": 1.0},
      {"id_inmueble": 2, "distancia_trabajo": 5.0, "margen_presupuesto": 100000,
       "match_cochera": 0, "tiene_balcon": 0, "es_silencioso": 0,
       "proximidad_salud": 0.2, "proximidad_verde": 0.1, "match_garantia": 0.0},
      {"id_inmueble": 3, "distancia_trabajo": 3.0, "margen_presupuesto": 0,
       "match_cochera": 1, "tiene_balcon": 1, "es_silencioso": 0,
       "proximidad_salud": 0.5, "proximidad_verde": 0.9, "match_garantia": 1.0},
  ]
  return pd.DataFrame(filas)


def test_utilidad_latente_en_rango_y_determinista():
  df = _df_features()
  utilidad_a = utilidad_latente(df, seed=7)
  utilidad_b = utilidad_latente(df, seed=7)

  assert utilidad_a.shape == (len(df),)
  assert (utilidad_a >= 0.0).all() and (utilidad_a <= 1.0).all()
  assert np.allclose(utilidad_a, utilidad_b)


def test_utilidad_latente_independiente_del_orden():
  df = _df_features()
  utilidad = utilidad_latente(df, seed=7)

  mezclado = df.sample(frac=1.0, random_state=0).reset_index(drop=True)
  utilidad_mezclada = utilidad_latente(mezclado, seed=7)

  por_id = dict(zip(df["id_inmueble"], utilidad))
  por_id_mezclado = dict(zip(mezclado["id_inmueble"], utilidad_mezclada))
  for id_inmueble, valor in por_id.items():
    assert valor == por_id_mezclado[id_inmueble]


def test_relevancia_binaria_marca_el_top():
  utilidad = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
  binaria = relevancia_binaria(utilidad, prop_relevantes=0.3)

  assert binaria.sum() == 3
  assert binaria[-3:].sum() == 3


def test_evaluar_recomendador_devuelve_metricas_validas():
  df = load_mock_properties()
  perfiles = [_perfil() for _ in range(8)]

  resultado = evaluar_recomendador(
      construir_content(), df, perfiles,
      k_values=(3, 5), prop_relevantes=0.3, seed=1234,
  )

  assert resultado["perfiles"] > 0
  assert 0.0 <= resultado["map"] <= 1.0
  assert 0.0 <= resultado["mrr"] <= 1.0
  cortes = {fila["k"] for fila in resultado["por_k"]}
  assert cortes == {3, 5}
  for fila in resultado["por_k"]:
    assert 0.0 <= fila["precision"] <= 1.0
    assert 0.0 <= fila["recall"] <= 1.0
    assert 0.0 <= fila["ndcg"] <= 1.0



def _store_con_feedback(fabrica):
  """Store con perfil guardado y feedback (favorito / visto / dislike)."""
  store = ServicioFeedback(RepositorioFeedback(fabrica=fabrica))
  store.guardar_perfil("ana@x.com", _perfil())
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  store.registrar("ana@x.com", 102, TIPO_VISTO)
  store.registrar("ana@x.com", 104, TIPO_NO_ME_GUSTA)
  return store


def test_construir_casos_feedback(fabrica):
  store = _store_con_feedback(fabrica)
  casos = construir_casos_feedback(store)

  assert len(casos) == 1
  caso = casos[0]
  assert "actualizado" not in caso["perfil"]
  assert caso["grados"][101] == 3.0
  assert caso["grados"][102] == 0.5
  assert 104 in caso["excluir"]


def test_construir_casos_feedback_sin_perfil(fabrica):
  store = ServicioFeedback(RepositorioFeedback(fabrica=fabrica))
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  assert construir_casos_feedback(store) == []


def test_evaluar_recomendador_feedback(fabrica):
  store = _store_con_feedback(fabrica)
  casos = construir_casos_feedback(store)
  df = load_mock_properties()

  resultado = evaluar_recomendador_feedback(
      construir_content(), df, casos, k_values=(3, 5)
  )

  assert resultado["perfiles"] == 1
  assert 0.0 <= resultado["map"] <= 1.0
  assert 0.0 <= resultado["mrr"] <= 1.0
  cortes = {fila["k"] for fila in resultado["por_k"]}
  assert cortes == {3, 5}
  for fila in resultado["por_k"]:
    assert 0.0 <= fila["precision"] <= 1.0
    assert 0.0 <= fila["recall"] <= 1.0
    assert 0.0 <= fila["ndcg"] <= 1.0


def test_evaluar_recomendador_feedback_excluye_dislikes(fabrica):
  store = _store_con_feedback(fabrica)
  casos = construir_casos_feedback(store)
  df = load_mock_properties()

  recomendador = construir_content()
  ranking_completo = recomendador.predict(df, casos[0]["perfil"])
  assert 104 in list(ranking_completo["id_inmueble"])

  excluir = casos[0]["excluir"]
  ranking_filtrado = ranking_completo[
      ~ranking_completo["id_inmueble"].isin(excluir)
  ]
  assert 104 not in list(ranking_filtrado["id_inmueble"])
