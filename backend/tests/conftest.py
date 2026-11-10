"""Fixtures compartidas por los tests del backend.

Cada test recibe una **base aislada** (un archivo SQLite en `tmp_path`) para no
escribir en `data/app.db` ni depender de PostgreSQL. Los servicios se construyen
con repositorios atados a esa base y se fijan como instancia del proceso, porque
los controladores las resuelven con `Depends`.
"""

import pytest

from app.repositories.ajuste_repository import RepositorioAjustes
from app.repositories.feedback_repository import RepositorioFeedback
from app.repositories.inmueble_repository import RepositorioInmuebles
from app.repositories.usuario_repository import RepositorioUsuarios
from app.services import ajuste_service, auth_service, feedback_service, inmueble_service
from app.services.ajuste_service import ServicioAjustes
from app.services.auth_service import ServicioAuth
from app.services.feedback_service import ServicioFeedback
from app.services.inmueble_service import ServicioInmuebles
from src import db


@pytest.fixture
def fabrica(tmp_path):
  """Fábrica de sesiones sobre una base SQLite aislada, con las tablas creadas."""
  url = "sqlite:///{0}".format(tmp_path / "test.db")
  factory = db.crear_fabrica(url)

  auth_service.fijar_servicio_auth(ServicioAuth(RepositorioUsuarios(fabrica=factory)))
  feedback_service.fijar_servicio_feedback(
      ServicioFeedback(RepositorioFeedback(fabrica=factory))
  )
  inmueble_service.fijar_servicio_inmuebles(
      ServicioInmuebles(RepositorioInmuebles(fabrica=factory))
  )
  ajuste_service.fijar_servicio_ajustes(
      ServicioAjustes(RepositorioAjustes(fabrica=factory))
  )
  ajuste_service.obtener_servicio_ajustes().cargar()

  yield factory

  auth_service.fijar_servicio_auth(None)
  feedback_service.fijar_servicio_feedback(None)
  inmueble_service.fijar_servicio_inmuebles(None)
  ajuste_service.fijar_servicio_ajustes(None)
  db.fijar_fabrica(None)


@pytest.fixture
def almacen(fabrica):
  """Servicio de autenticación sobre la base aislada."""
  return ServicioAuth(RepositorioUsuarios(fabrica=fabrica))


@pytest.fixture
def almacen_feedback(fabrica):
  """Servicio de feedback sobre la base aislada."""
  return ServicioFeedback(RepositorioFeedback(fabrica=fabrica))
