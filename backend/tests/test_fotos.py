"""Tests del etiquetado de fotos por ambiente (`src/fotos.py`)."""

from src.fotos import (
    AMBIENTES_FOTOS,
    contar_fotos_en_seccion,
    error_etiqueta,
    etiqueta_seccion,
    secciones_cubiertas,
)


def _foto(ambiente, numero=None, **extras):
  foto = {"url": "http://x/f.jpg", "ambiente": ambiente, "numero": numero}
  foto.update(extras)
  return foto


def test_ambientes_incluyen_las_secciones_del_inmueble():
  for ambiente in ("living", "comedor", "cocina", "dormitorio", "bano",
                   "lavadero", "patio", "patio_interno", "balcon", "cochera",
                   "vista", "amenities", "otros"):
    assert ambiente in AMBIENTES_FOTOS


def test_etiqueta_seccion_formatea_numero():
  assert etiqueta_seccion("dormitorio", 2) == "Dormitorio 2"
  assert etiqueta_seccion("bano", 1) == "Baño 1"
  assert etiqueta_seccion("living", None) == "Living"
  assert etiqueta_seccion("patio_interno", None) == "Patio interno"


def test_secciones_cubiertas_con_doble_etiqueta():
  fotos = [
      _foto("living", ambiente2="comedor"),
      _foto("dormitorio", numero=1),
      "http://x/legacy.jpg",
  ]
  assert secciones_cubiertas(fotos) == {
      ("living", None), ("comedor", None), ("dormitorio", 1), ("otros", None),
  }


def test_contar_fotos_en_seccion_ignora_legacy():
  fotos = [
      _foto("comedor"),
      _foto("comedor"),
      "http://x/legacy.jpg",
      _foto("living", ambiente2="comedor"),
  ]
  assert contar_fotos_en_seccion(fotos, "comedor", None) == 3
  assert contar_fotos_en_seccion(fotos, "living", None) == 1
  assert contar_fotos_en_seccion(fotos, "cocina", None) == 0


def test_error_etiqueta_ambiente_invalido():
  assert error_etiqueta("sotano", None, {}) is not None
  assert error_etiqueta("living", None, {}) is None


def test_error_etiqueta_numero_obligatorio_en_dormitorio_y_bano():
  inmueble = {"cantidad_habitaciones": 2, "cantidad_banos": 1}
  assert error_etiqueta("dormitorio", None, inmueble) is not None
  assert error_etiqueta("dormitorio", 2, inmueble) is None
  assert error_etiqueta("bano", 1, inmueble) is None
  assert error_etiqueta("cocina", None, inmueble) is None


def test_error_etiqueta_numero_acotado_por_cantidad_declarada():
  inmueble = {"cantidad_habitaciones": 2, "cantidad_banos": 1}
  assert error_etiqueta("dormitorio", 3, inmueble) is not None
  assert error_etiqueta("bano", 2, inmueble) is not None
  assert error_etiqueta("dormitorio", 5, {}) is None
