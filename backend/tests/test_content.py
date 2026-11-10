import pandas as pd

from src.config import FEATURE_COLS
from src.models.content_model import ContentRecommender


def _perfil(**overrides):
  base = {
      "presupuesto_max": 300000,
      "tiene_mascota": True,
      "requiere_cochera": False,
      "prefiere_cochera": True,
      "requiere_balcon": False,
      "hace_home_office": True,
      "nivel_tolerancia_ruido": "bajo",
      "frecuencia_lavado": "media",
      "lat_trabajo": -27.469,
      "lon_trabajo": -58.830,
      "distancia_max_trabajo_km": 5.0,
      "pesos_usuario": {
          "precio": 0.35,
          "ubicacion": 0.30,
          "habitos_confort": 0.20,
          "amenities": 0.15,
      },
  }
  base.update(overrides)
  return base


def _inmueble(**overrides):
  base = {
      "id_inmueble": 1,
      "precio": 200000,
      "acepta_mascotas": True,
      "tiene_cochera": True,
      "cochera_techada": True,
      "lat": -27.470,
      "lon": -58.831,
      "tipologia": "departamento",
      "es_monoambiente": False,
      "cantidad_habitaciones": 2,
      "cantidad_banos": 1,
      "cantidad_banos_en_suite": 1,
      "piso": 3,
      "orientacion": "contrafrente",
      "tipo_unidad": "edificio",
      "cocina_separada": True,
      "living_separado": True,
      "tiene_lavadero": True,
      "lavadero_separado": True,
      "balcon_ubicacion": "frente",
      "espacio_home_office": True,
  }
  base.update(overrides)
  return base


def _inmuebles():
  return pd.DataFrame([
      _inmueble(id_inmueble=1),
      _inmueble(id_inmueble=2, acepta_mascotas=False),
      _inmueble(id_inmueble=3, precio=400000),
  ])


def test_filtros_duros_excluyen_inmuebles():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  resultado = rec.predict(_inmuebles(), _perfil())

  assert list(resultado["id_inmueble"]) == [1]


def test_tamano_mascota_excede_maximo_del_inmueble():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  df = pd.DataFrame([
      _inmueble(id_inmueble=1, tamano_maximo_mascota="chico"),
      _inmueble(id_inmueble=2, tamano_maximo_mascota="mediano"),
      _inmueble(id_inmueble=3, tamano_maximo_mascota="indistinto"),
      _inmueble(id_inmueble=4),
  ])
  perfil = _perfil(tiene_mascota=True, tamano_mascota="mediano")
  resultado = rec.predict(df, perfil)
  assert list(resultado["id_inmueble"]) == [2, 3, 4]


def test_score_en_rango_y_ordenado():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  perfil = _perfil(tiene_mascota=False, presupuesto_max=500000)
  resultado = rec.predict(_inmuebles(), perfil)

  assert (resultado["score_compatibilidad"] >= 0).all()
  assert (resultado["score_compatibilidad"] <= 100).all()
  scores = resultado["score_compatibilidad"].tolist()
  assert scores == sorted(scores, reverse=True)


def test_calcula_features_derivadas():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  resultado = rec.predict(_inmuebles(), _perfil(tiene_mascota=False))

  for columna in [
      "distancia_trabajo",
      "margen_presupuesto",
      "match_cochera",
      "tiene_balcon",
      "es_silencioso",
      "proximidad_salud",
      "proximidad_verde",
      "match_garantia",
  ]:
    assert columna in resultado.columns


def test_es_silencioso_se_deriva_de_la_orientacion():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  df = pd.DataFrame([
      _inmueble(id_inmueble=1, orientacion="contrafrente", tipo_unidad="edificio"),
      _inmueble(id_inmueble=2, orientacion="frente", tipo_unidad="edificio"),
  ])
  resultado = rec.predict(df, _perfil(tiene_mascota=False))

  silencioso = dict(zip(resultado["id_inmueble"], resultado["es_silencioso"]))
  assert silencioso[1] == 1
  assert silencioso[2] == 0


def test_pesos_se_normalizan():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  perfil = _perfil(
      pesos_usuario={
          "precio": 7.0,
          "ubicacion": 3.0,
          "habitos_confort": 0.0,
          "amenities": 0.0,
      }
  )
  resultado = rec.predict(_inmuebles(), perfil)
  assert (resultado["score_compatibilidad"] <= 100).all()


def test_proximidad_salud_mejora_ubicacion():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  df = pd.DataFrame([
      _inmueble(
          id_inmueble=1,
          proximidad={
              "distancia_caps_m": 200,
              "distancia_hospital_m": 300,
              "distancia_clinica_m": 250,
          },
      ),
      _inmueble(
          id_inmueble=2,
          proximidad={
              "distancia_caps_m": 1500,
              "distancia_hospital_m": 2000,
              "distancia_clinica_m": 1800,
          },
      ),
  ])
  resultado = rec.predict(df, _perfil(tiene_mascota=False))
  scores = dict(zip(resultado["id_inmueble"], resultado["score_ubicacion"]))
  assert scores[1] > scores[2]


def test_filtro_moneda_preferida():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  df = pd.DataFrame([
      _inmueble(id_inmueble=1, moneda="ARS", moneda_a_convenir=False),
      _inmueble(id_inmueble=2, moneda="USD", moneda_a_convenir=False),
      _inmueble(id_inmueble=3, moneda="USD", moneda_a_convenir=True),
  ])
  perfil = _perfil(tiene_mascota=False, moneda_preferida="ARS")
  resultado = rec.predict(df, perfil)

  ids = set(resultado["id_inmueble"])
  assert 1 in ids
  assert 2 not in ids
  assert 3 in ids


def test_match_garantia_penaliza_sin_coincidencia():
  rec = ContentRecommender(feature_cols=FEATURE_COLS)
  df = pd.DataFrame([
      _inmueble(
          id_inmueble=1,
          garantias={
              "seguro_caucion": True,
              "garantia_a_propietario": False,
              "titulo_propiedad": False,
          },
      ),
      _inmueble(
          id_inmueble=2,
          garantias={
              "seguro_caucion": False,
              "garantia_a_propietario": True,
              "titulo_propiedad": True,
          },
      ),
  ])
  perfil = _perfil(tiene_mascota=False, tiene_garantia_recibo=True)
  resultado = rec.predict(df, perfil)
  match = dict(zip(resultado["id_inmueble"], resultado["match_garantia"]))
  assert match[1] == 1.0
  assert match[2] == 0.0
