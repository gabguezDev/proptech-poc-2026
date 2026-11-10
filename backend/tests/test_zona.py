"""Tests del match de zona (radio y polígono)."""

import pandas as pd

from app.services.recomendacion_service import ServicioRecomendacion
from src.utils import haversine_km, punto_en_poligono, punto_en_radio


def test_haversine_km():
  assert 110 <= haversine_km(0, 0, 1, 0) <= 112


def test_punto_en_radio():
  assert punto_en_radio(0, 0, 0, 0, 0.1)
  assert not punto_en_radio(0.01, 0, 0, 0, 0.1)


def test_punto_en_poligono():
  cuadrado = [
      {"lat": 0, "lon": 0},
      {"lat": 0, "lon": 1},
      {"lat": 1, "lon": 1},
      {"lat": 1, "lon": 0},
  ]
  assert punto_en_poligono(0.5, 0.5, cuadrado)
  assert not punto_en_poligono(2, 2, cuadrado)
  assert not punto_en_poligono(0.5, 0.5, [])


def _df():
  return pd.DataFrame(
      [
          {"id_inmueble": 1, "lat": 0.0, "lon": 0.0, "score_compatibilidad": 80.0,
           "score_ubicacion": 0.8},
          {"id_inmueble": 2, "lat": 1.0, "lon": 1.0, "score_compatibilidad": 80.0,
           "score_ubicacion": 0.8},
      ]
  )


def test_preferencia_alquiler_jerarquia():
  df = pd.DataFrame(
      [
          {"id_inmueble": 1, "agente_email": "ag@x.com", "score_compatibilidad": 80.0},
          {"id_inmueble": 2, "agente_email": None, "score_compatibilidad": 80.0},
      ]
  )
  resultado = ServicioRecomendacion._aplicar_preferencia_alquiler(
      df, {"preferencia_alquiler": "inmobiliaria_primero"}
  )
  fila = resultado.set_index("id_inmueble")
  assert fila.loc[1, "preferencia_match"] == 1
  assert fila.loc[1, "score_compatibilidad"] == 88.0
  assert fila.loc[2, "preferencia_match"] == 0
  assert fila.loc[2, "score_compatibilidad"] == 76.0


def test_sin_zona_no_cambia_scores():
  resultado = ServicioRecomendacion._aplicar_zona(_df(), {})
  assert list(resultado["zona_match"]) == [1, 1]
  assert list(resultado["score_compatibilidad"]) == [80.0, 80.0]


def test_zona_radio_penaliza_fuera():
  perfil = {
      "zona_tipo": "radio",
      "zona_lat": 0.0,
      "zona_lon": 0.0,
      "zona_radio_km": 1.0,
  }
  resultado = ServicioRecomendacion._aplicar_zona(_df(), perfil)
  fila = resultado.set_index("id_inmueble")
  assert fila.loc[1, "zona_match"] == 1
  assert fila.loc[1, "score_compatibilidad"] == 80.0
  assert fila.loc[2, "zona_match"] == 0
  assert fila.loc[2, "score_compatibilidad"] == 56.0
  assert resultado.iloc[0]["id_inmueble"] == 1


def test_zona_poligono():
  perfil = {
      "zona_tipo": "poligono",
      "zona_puntos": [
          {"lat": -0.5, "lon": -0.5},
          {"lat": -0.5, "lon": 0.5},
          {"lat": 0.3, "lon": 0.6},
          {"lat": 0.5, "lon": 0.0},
          {"lat": 0.5, "lon": -0.6},
      ],
  }
  resultado = ServicioRecomendacion._aplicar_zona(_df(), perfil)
  fila = resultado.set_index("id_inmueble")
  assert fila.loc[1, "zona_match"] == 1
  assert fila.loc[2, "zona_match"] == 0
