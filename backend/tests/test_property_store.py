"""Tests del catálogo editable y del control de propiedad (ownership)."""

import pytest

from app.core.seguridad import ROL_ADMIN, ROL_AGENTE, ROL_PROPIETARIO
from app.repositories.inmueble_repository import RepositorioInmuebles
from app.services import inmueble_service
from app.services.inmueble_service import ServicioInmuebles

OWNER = "dueno@proptech.local"
AGENT = "agente@proptech.local"


@pytest.fixture
def store(fabrica):
  """Aísla el catálogo en una base temporal y la siembra con el ownership demo."""
  servicio = ServicioInmuebles(RepositorioInmuebles(fabrica=fabrica))
  servicio.sembrar(OWNER, AGENT)
  return servicio


def _usuario(email, rol):
  return {"id": 1, "email": email, "rol": rol}


def test_borrador_no_sale_en_catalogo_publico(store):
  borrador = store.crear(
      {
          "precio": 100000,
          "tipologia": "casa",
          "lat": -27.4,
          "lon": -58.8,
          "titulo": "Borrador de prueba",
          "estado": "borrador",
      },
      propietario_email=OWNER,
  )
  assert borrador["estado"] == "borrador"
  assert borrador["titulo"] == "Borrador de prueba"
  ids = set(store.load_properties()["id_inmueble"])
  assert borrador["id_inmueble"] not in ids
  propios = {r["id_inmueble"] for r in store.gestionados_por(_usuario(OWNER, ROL_PROPIETARIO))}
  assert borrador["id_inmueble"] in propios
  store.actualizar(borrador["id_inmueble"], {"estado": "publicado"})
  assert borrador["id_inmueble"] in set(store.load_properties()["id_inmueble"])


def test_alquilada_sale_del_catalogo_publico(store):
  creado = store.crear(
      {"precio": 100000, "tipologia": "casa", "lat": 0, "lon": 0},
      propietario_email=OWNER,
  )
  actualizado = store.actualizar(creado["id_inmueble"], {"estado": "alquilada"})
  assert actualizado["estado"] == "alquilada"
  assert creado["id_inmueble"] not in set(store.load_properties()["id_inmueble"])
  store.actualizar(creado["id_inmueble"], {"estado": "publicado"})
  assert creado["id_inmueble"] in set(store.load_properties()["id_inmueble"])


def test_estado_invalido_rechaza(store):
  with pytest.raises(ValueError):
    store.crear(
        {"precio": 1, "tipologia": "casa", "lat": 0, "lon": 0, "estado": "otro"}
    )


def test_subir_fotos_y_listar_galeria(store):
  """La galería se agrega a `fotos` y valida tipo, tamaño y cantidad."""
  from app.services.storage_service import ServicioStorage

  class ClienteFalso:
    def __init__(self):
      self.subidos = {}

    def put(self, url, content, headers, timeout):
      self.subidos[url] = content

      class Respuesta:
        def raise_for_status(self):
          pass

      return Respuesta()

  storage = ServicioStorage(cliente_http=ClienteFalso())
  creado = store.crear(
      {"precio": 100000, "tipologia": "casa", "lat": 0, "lon": 0},
      propietario_email=OWNER,
  )
  url = storage.subir(creado["id_inmueble"], "foto.jpg", b"123", "image/jpeg")
  assert url.startswith("http")
  actualizado = store.actualizar(creado["id_inmueble"], {"fotos": [url]})
  assert actualizado["fotos"] == [url]


def test_sembrar_asigna_propiedad(store):
  r101 = store.obtener(101)
  assert r101[inmueble_service.CAMPO_PROPIETARIO] == OWNER
  assert r101[inmueble_service.CAMPO_AGENTE] is None
  r104 = store.obtener(104)
  assert r104[inmueble_service.CAMPO_PROPIETARIO] == OWNER
  assert r104[inmueble_service.CAMPO_AGENTE] == AGENT
  r105 = store.obtener(105)
  assert r105[inmueble_service.CAMPO_PROPIETARIO] is None
  assert r105[inmueble_service.CAMPO_AGENTE] == AGENT
  r110 = store.obtener(110)
  assert r110[inmueble_service.CAMPO_PROPIETARIO] is None
  assert r110[inmueble_service.CAMPO_AGENTE] is None


def test_sembrar_es_idempotente(store):
  assert store.sembrar(OWNER, AGENT) is False


def test_load_properties_incluye_columnas_de_control(store):
  df = store.load_properties()
  assert len(df) == 11
  assert inmueble_service.CAMPO_PROPIETARIO in df.columns
  assert inmueble_service.CAMPO_AGENTE in df.columns


def test_gestiona_segun_rol(store):
  r101 = store.obtener(101)
  assert store.gestiona(r101, _usuario(OWNER, ROL_PROPIETARIO))
  assert not store.gestiona(r101, _usuario("otro@example.com", ROL_PROPIETARIO))
  assert store.gestiona(r101, _usuario("x", ROL_ADMIN))
  assert not store.gestiona(r101, None)

  r105 = store.obtener(105)
  assert store.gestiona(r105, _usuario(AGENT, ROL_AGENTE))
  assert not store.gestiona(r105, _usuario(OWNER, ROL_PROPIETARIO))


def test_gestionados_por(store):
  del_owner = store.gestionados_por(_usuario(OWNER, ROL_PROPIETARIO))
  ids = {r["id_inmueble"] for r in del_owner}
  assert ids == {101, 102, 103, 104}

  del_agente = store.gestionados_por(_usuario(AGENT, ROL_AGENTE))
  ids_agente = {r["id_inmueble"] for r in del_agente}
  assert ids_agente == {104, 105, 106}

  todos = store.gestionados_por(_usuario("admin", ROL_ADMIN))
  assert len(todos) == 11


def test_crear_asigna_id_propiedad_y_completa_claves(store):
  nuevo = store.crear(
      {"precio": 123456, "tipologia": "monoambiente", "lat": -27.4, "lon": -58.8},
      propietario_email=OWNER,
  )
  assert nuevo["id_inmueble"] == 112
  assert nuevo[inmueble_service.CAMPO_PROPIETARIO] == OWNER
  assert nuevo[inmueble_service.CAMPO_AGENTE] is None
  assert nuevo["expensas"] is None
  assert "pension" in nuevo
  assert store.obtener(112) is not None


def test_crear_con_id_duplicado_falla(store):
  with pytest.raises(ValueError):
    store.crear({"id_inmueble": 101, "precio": 1}, propietario_email=OWNER)


def test_actualizar_fusiona_y_no_toca_control(store):
  actualizado = store.actualizar(
      101, {"precio": 999999, inmueble_service.CAMPO_PROPIETARIO: "hack@x.com"}
  )
  assert actualizado["precio"] == 999999
  assert actualizado[inmueble_service.CAMPO_PROPIETARIO] == OWNER
  assert store.obtener(101)["precio"] == 999999


def test_actualizar_inexistente_devuelve_none(store):
  assert store.actualizar(9999, {"precio": 1}) is None
