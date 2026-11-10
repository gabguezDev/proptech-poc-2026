"""Tests del feedback del inquilino (favoritos, reacciones e interacciones)."""

import pandas as pd
import pytest

from app.repositories.feedback_repository import RepositorioFeedback
from app.services.feedback_service import ServicioFeedback
from src.feedback_tipos import (
    GRADO_RELEVANTE,
    TIPO_CONTACTO,
    TIPO_FAVORITO,
    TIPO_ME_GUSTA,
    TIPO_NO_ME_GUSTA,
    TIPO_VISTO,
)


def _store(fabrica):
  return ServicioFeedback(RepositorioFeedback(fabrica=fabrica))


def test_registrar_y_listar(fabrica):
  store = _store(fabrica)
  entrada = store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  assert entrada["usuario_email"] == "ana@x.com"
  assert entrada["tipo"] == TIPO_FAVORITO
  assert entrada["repeticiones"] == 1

  listado = store.listar_usuario("ana@x.com")
  assert len(listado) == 1
  assert store.listar_usuario("otro@x.com") == []


def test_tipo_invalido_falla(fabrica):
  store = _store(fabrica)
  with pytest.raises(ValueError):
    store.registrar("ana@x.com", 101, "super_like")


def test_reacciones_son_excluyentes(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 101, TIPO_NO_ME_GUSTA)
  store.registrar("ana@x.com", 101, TIPO_ME_GUSTA)

  tipos = store.mapa_usuario("ana@x.com")[101]
  assert tipos == [TIPO_ME_GUSTA]


def test_favorito_y_reaccion_conviven(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  store.registrar("ana@x.com", 101, TIPO_ME_GUSTA)

  tipos = sorted(store.mapa_usuario("ana@x.com")[101])
  assert tipos == [TIPO_FAVORITO, TIPO_ME_GUSTA]


def test_interacciones_acumulan_repeticiones(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 101, TIPO_VISTO)
  entrada = store.registrar("ana@x.com", 101, TIPO_VISTO)
  assert entrada["repeticiones"] == 2

  e1 = store.registrar("ana@x.com", 102, TIPO_FAVORITO)
  e2 = store.registrar("ana@x.com", 102, TIPO_FAVORITO)
  assert e1["repeticiones"] == 1 and e2["repeticiones"] == 1


def test_eliminar_especifico_y_total(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  store.registrar("ana@x.com", 101, TIPO_CONTACTO)

  assert store.eliminar("ana@x.com", 101, TIPO_FAVORITO) == 1
  assert store.mapa_usuario("ana@x.com")[101] == [TIPO_CONTACTO]
  assert store.eliminar("ana@x.com", 101) == 1
  assert store.mapa_usuario("ana@x.com") == {}
  assert store.eliminar("ana@x.com", 101) == 0


def test_resumen_inmueble(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)
  store.registrar("beto@x.com", 101, TIPO_FAVORITO)
  store.registrar("ana@x.com", 101, TIPO_VISTO)

  resumen = store.resumen_inmueble(101)
  assert resumen[TIPO_FAVORITO] == 2
  assert resumen[TIPO_VISTO] == 1
  assert resumen[TIPO_NO_ME_GUSTA] == 0


def test_persistencia_en_disco(fabrica):
  """Dos instancias sobre la misma base ven lo escrito por la primera."""
  ServicioFeedback(RepositorioFeedback(fabrica=fabrica)).registrar("ana@x.com", 101, TIPO_FAVORITO)
  recargado = ServicioFeedback(RepositorioFeedback(fabrica=fabrica))
  assert len(recargado.listar_usuario("ana@x.com")) == 1


def test_guardar_y_obtener_perfil(fabrica):
  store = _store(fabrica)
  store.guardar_perfil("ana@x.com", {"presupuesto_max": 200000})

  perfil = store.obtener_perfil("ana@x.com")
  assert perfil["presupuesto_max"] == 200000
  assert "actualizado" in perfil


def test_aplicar_ranking_excluye_dislikes_y_boostea(fabrica):
  store = _store(fabrica)
  store.registrar("ana@x.com", 102, TIPO_NO_ME_GUSTA)
  store.registrar("ana@x.com", 101, TIPO_FAVORITO)

  df = pd.DataFrame([
      {"id_inmueble": 101, "score_compatibilidad": 60.0},
      {"id_inmueble": 102, "score_compatibilidad": 90.0},
      {"id_inmueble": 103, "score_compatibilidad": 70.0},
  ])
  resultado, mapa = store.aplicar_ranking(df, "ana@x.com", boost=1.5)

  ids = list(resultado["id_inmueble"])
  assert 102 not in ids
  assert ids[0] == 101
  assert resultado.iloc[0]["score_compatibilidad"] == 90.0
  assert 101 in mapa


def test_aplicar_ranking_sin_boost(fabrica):
  store = _store(fabrica)
  df = pd.DataFrame([
      {"id_inmueble": 101, "score_compatibilidad": 60.0},
      {"id_inmueble": 102, "score_compatibilidad": 90.0},
  ])
  resultado, _ = store.aplicar_ranking(df, "nadie@x.com", boost=1.5)
  assert list(resultado["id_inmueble"]) == [101, 102]


def test_sembrar_demo_es_idempotente(fabrica):
  store = _store(fabrica)
  items = [(101, TIPO_FAVORITO), (102, TIPO_NO_ME_GUSTA)]
  assert store.sembrar_demo("ana@x.com", {"presupuesto_max": 1}, items) is True
  assert store.sembrar_demo("ana@x.com", {"presupuesto_max": 1}, items) is False
  assert len(store.listar_usuario("ana@x.com")) == 2
  assert store.obtener_perfil("ana@x.com")["presupuesto_max"] == 1


def test_grado_relevante_es_me_gusta(fabrica):
  from src.feedback_tipos import GRADO_FEEDBACK
  assert GRADO_FEEDBACK[TIPO_FAVORITO] >= GRADO_RELEVANTE
  assert GRADO_FEEDBACK[TIPO_ME_GUSTA] >= GRADO_RELEVANTE
  assert GRADO_FEEDBACK[TIPO_VISTO] < GRADO_RELEVANTE
