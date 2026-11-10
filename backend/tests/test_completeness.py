import pandas as pd

from src.completeness import (
    TOPE_SIN_CRITICOS,
    aplicar_penalizacion_completitud,
    calcular_score_carga,
    detalle_completitud,
)


def _inmueble(**overrides):
  """Inmueble completamente cargado (sirve de base para quitar campos)."""
  base = {
      "id_inmueble": 1,
      "titulo": "Departamento de prueba",
      "fotos": [
          {"url": "http://x/1.jpg", "ambiente": "living", "numero": None},
          {"url": "http://x/2.jpg", "ambiente": "comedor", "numero": None},
          {"url": "http://x/3.jpg", "ambiente": "cocina", "numero": None},
          {"url": "http://x/4.jpg", "ambiente": "dormitorio", "numero": 1},
          {"url": "http://x/5.jpg", "ambiente": "dormitorio", "numero": 2},
          {"url": "http://x/6.jpg", "ambiente": "bano", "numero": 1},
      ],
      "tiene_patio": True,
      "patio_cesped": False,
      "precio": 200000,
      "moneda": "ARS",
      "moneda_a_convenir": False,
      "expensas": {
          "promedio_ultimos_3_meses": 30000,
          "incluye": {
              "agua_potable": True,
              "gas": True,
              "energia_electrica_espacios_comunes": True,
              "energia_electrica_departamento": False,
              "limpieza_espacios_comunes": True,
              "guardia_camaras": True,
              "mano_obra_mantenimiento": True,
              "mantenimiento_ascensor": True,
              "otros": [],
          },
      },
      "tipologia": "departamento",
      "es_monoambiente": False,
      "cantidad_habitaciones": 2,
      "cantidad_banos": 1,
      "cantidad_banos_en_suite": 1,
      "piso": 3,
      "acceso": "ascensor",
      "orientacion": "contrafrente",
      "tipo_unidad": "edificio",
      "edificio": {
          "tiene_ascensor": True,
          "tiene_quincho": False,
          "quincho_ubicacion": None,
          "tiene_terraza": True,
          "terraza_incluida_expensas": True,
          "tiene_gimnasio": False,
          "tiene_piscina": False,
          "otros_amenities": [],
      },
      "cocina_separada": True,
      "living_separado": True,
      "tiene_lavadero": True,
      "lavadero_separado": True,
      "balcon_ubicacion": "frente",
      "espacio_home_office": True,
      "acepta_mascotas": True,
      "tamano_maximo_mascota": "mediano",
      "tiene_cochera": True,
      "cochera_techada": True,
      "espacio_moto_bicicleta": True,
      "lat": -27.470,
      "lon": -58.830,
      "proximidad": {
          "distancia_quiosco_m": 120,
          "distancia_autoservicio_m": 280,
          "distancia_supermercado_m": 350,
          "distancia_hipermercado_m": 1400,
          "distancia_plaza_m": 200,
          "distancia_parque_m": 700,
          "distancia_escuela_m": 180,
          "distancia_colegio_m": 320,
          "distancia_instituto_terciario_m": 480,
          "distancia_universidad_m": 650,
          "distancia_caps_m": 250,
          "distancia_hospital_m": 800,
          "distancia_clinica_m": 600,
      },
      "contrato": {
          "duracion_meses": 24,
          "duracion_a_convenir": False,
          "frecuencia_aumento_meses": 6,
          "indice_ajuste": "ICL",
          "frecuencia_aumento_a_convenir": False,
      },
      "garantias": {
          "seguro_caucion": True,
          "garantia_a_propietario": False,
          "garantia_a_propietario_reembolsable": None,
          "titulo_propiedad": False,
      },
      "pension": None,
  }
  base.update(overrides)
  return base


def test_inmueble_completo_saca_100():
  assert calcular_score_carga(_inmueble()) == 100.0


def test_inmueble_incompleto_baja_el_score():
  completo = calcular_score_carga(_inmueble())
  sin_bloques = calcular_score_carga(
      _inmueble(proximidad=None, garantias=None, contrato=None, edificio=None)
  )

  assert sin_bloques < completo
  assert sin_bloques > TOPE_SIN_CRITICOS


def test_campo_critico_faltante_topea_el_score():
  score = calcular_score_carga(_inmueble(precio=None))
  assert score <= TOPE_SIN_CRITICOS


def test_campos_condicionales_no_penalizan_si_no_aplican():
  interno = _inmueble(tipo_unidad="interno", edificio=None)
  assert calcular_score_carga(interno) == 100.0

  depto = _inmueble(tipologia="departamento", pension=None)
  assert calcular_score_carga(depto) == 100.0


def test_casa_y_complejo_tambien_cargan_amenities():
  casa_completa = _inmueble(tipo_unidad="casa")
  assert calcular_score_carga(casa_completa) == 100.0

  casa_sin_amenities = _inmueble(tipo_unidad="casa", edificio=None)
  detalle = detalle_completitud(casa_sin_amenities)
  campos_faltantes = {f["campo"] for f in detalle["faltantes"]}
  assert "edificio.tiene_quincho" in campos_faltantes


def test_detalle_completitud_reporta_faltantes_y_grupos():
  detalle = detalle_completitud(_inmueble(proximidad=None, garantias=None))

  assert detalle["id_inmueble"] == 1
  assert detalle["score_carga"] < 100.0
  assert "ubicacion" in detalle["grupos"] and "garantias" in detalle["grupos"]
  assert detalle["grupos"]["garantias"] == 0.0

  campos_faltantes = {f["campo"] for f in detalle["faltantes"]}
  assert "proximidad.distancia_hospital_m" in campos_faltantes
  assert all("etiqueta" in f and "critico" in f for f in detalle["faltantes"])



def _foto(ambiente, numero=None, url="http://x/f.jpg", **extras):
  foto = {"url": url, "ambiente": ambiente, "numero": numero}
  foto.update(extras)
  return foto


def test_cobertura_fotos_exige_secciones_distintas():
  inmueble = _inmueble(fotos=[
      _foto("living", url="http://x/1.jpg"),
      _foto("living", url="http://x/2.jpg"),
      _foto("living", url="http://x/3.jpg"),
  ])
  detalle = detalle_completitud(inmueble)
  campos_faltantes = {f["campo"] for f in detalle["faltantes"]}
  assert "fotos" not in campos_faltantes
  assert "cobertura_fotos" in campos_faltantes
  assert detalle["secciones_fotos"] == ["Living"]
  assert calcular_score_carga(inmueble) < 100.0


def test_fotos_legacy_cuentan_una_seccion_otros():
  inmueble = _inmueble(fotos=["http://x/1.jpg", "http://x/2.jpg"])
  detalle = detalle_completitud(inmueble)
  assert detalle["secciones_fotos"] == ["Otros"]


def test_doble_etiqueta_cubre_dos_secciones():
  inmueble = _inmueble(fotos=[
      _foto("living", ambiente2="comedor", numero=None, url="http://x/1.jpg"),
  ])
  detalle = detalle_completitud(inmueble)
  assert detalle["secciones_fotos"] == ["Comedor", "Living"]


def test_seis_secciones_cubiertas_completan_la_cobertura():
  detalle = detalle_completitud(_inmueble())
  campos_faltantes = {f["campo"] for f in detalle["faltantes"]}
  assert "cobertura_fotos" not in campos_faltantes
  assert "Dormitorio 2" in detalle["secciones_fotos"]


def test_penalizacion_reduce_la_compatibilidad():
  df = pd.DataFrame([
      dict(_inmueble(id_inmueble=1), score_compatibilidad=90.0),
      dict(
          _inmueble(id_inmueble=2, proximidad=None, garantias=None, contrato=None),
          score_compatibilidad=90.0,
      ),
  ])

  resultado = aplicar_penalizacion_completitud(df)
  por_id = resultado.set_index("id_inmueble")

  assert {"score_carga", "factor_completitud"}.issubset(resultado.columns)
  assert por_id.loc[1, "factor_completitud"] == 1.0
  assert por_id.loc[1, "score_compatibilidad"] == 90.0
  assert por_id.loc[2, "score_compatibilidad"] < 90.0
  assert list(resultado["id_inmueble"]) == [1, 2]
