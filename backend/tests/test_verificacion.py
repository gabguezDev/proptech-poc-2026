"""Tests de la verificación de afirmaciones (vio / no vio / no sé)."""

import pytest

from app.services.feedback_service import ServicioFeedback
from app.repositories.feedback_repository import RepositorioFeedback
from src.feedback_tipos import (
    TIPO_NO_SE,
    TIPO_NO_VIO,
    TIPO_VIO,
    TIPO_VISITA_CONFIRMADA,
)


def _servicio(fabrica):
  return ServicioFeedback(RepositorioFeedback(fabrica=fabrica))


def _confirmar_visita(servicio, email="ana@x.com", id_inmueble=101):
  servicio.confirmar_visita(email, id_inmueble)


def test_verificacion_requiere_visita_confirmada(fabrica):
  servicio = _servicio(fabrica)
  with pytest.raises(ValueError):
    servicio.registrar("ana@x.com", 101, TIPO_VIO, "distancia_hospital_m")
  _confirmar_visita(servicio)
  entrada = servicio.registrar("ana@x.com", 101, TIPO_VIO, "distancia_hospital_m")
  assert entrada["tipo"] == TIPO_VIO


def test_verificacion_por_afirmacion(fabrica):
  servicio = _servicio(fabrica)
  _confirmar_visita(servicio)
  entrada = servicio.registrar("ana@x.com", 101, TIPO_VIO, "distancia_hospital_m")
  assert entrada["tipo"] == TIPO_VIO
  assert entrada["detalle"] == "distancia_hospital_m"

  servicio.registrar("ana@x.com", 101, TIPO_VIO, "distancia_plaza_m")
  tipos = [
      e["detalle"]
      for e in servicio.listar_usuario("ana@x.com")
      if e["tipo"] in (TIPO_VIO, TIPO_NO_VIO, TIPO_NO_SE)
  ]
  assert sorted(tipos) == ["distancia_hospital_m", "distancia_plaza_m"]

  servicio.registrar("ana@x.com", 101, TIPO_NO_VIO, "distancia_hospital_m")
  opiniones = {
      e["detalle"]: e["tipo"]
      for e in servicio.listar_usuario("ana@x.com")
      if e["tipo"] in (TIPO_VIO, TIPO_NO_VIO, TIPO_NO_SE)
  }
  assert opiniones == {
      "distancia_hospital_m": TIPO_NO_VIO,
      "distancia_plaza_m": TIPO_VIO,
  }


def test_eliminar_verificaciones_por_tipo(fabrica):
  servicio = _servicio(fabrica)
  _confirmar_visita(servicio)
  servicio.registrar("ana@x.com", 101, TIPO_VIO, "distancia_hospital_m")
  servicio.registrar("ana@x.com", 101, TIPO_NO_SE, "distancia_plaza_m")
  quitados = servicio.eliminar("ana@x.com", 101, TIPO_VIO)
  assert quitados == 1
  restantes = [
      e["detalle"]
      for e in servicio.listar_usuario("ana@x.com")
      if e["tipo"] in (TIPO_VIO, TIPO_NO_VIO, TIPO_NO_SE)
  ]
  assert restantes == ["distancia_plaza_m"]
