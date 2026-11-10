"""Conexión a la base de datos relacional y fábrica de sesiones.

La base de producción es **PostgreSQL** (ver `DATABASE_URL` en `docker-compose.yml`).
Si la variable de entorno no está definida —caso de correr el backend a mano o
de los tests— se usa un archivo **SQLite** local, con el mismo esquema, para no
obligar a tener el contenedor levantado. Los tipos de columna se eligieron
portables (`JSON` con variante `JSONB` en PostgreSQL) para que ambos backends
compartan definición.

Uso típico:

    from src import db
    db.inicializar()                 # crea tablas si no existen
    with db.sesion() as sesion:      # transacción
        ...

Para tests se puede crear una fábrica aislada:

    fabrica = db.crear_fabrica("sqlite:///" + str(tmp_path / "test.db"))
"""

import os
from contextlib import contextmanager
from typing import Optional

from sqlalchemy import create_engine, engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from src.config import BASE_DIR, DATABASE_SQLITE_RUTA


class Base(DeclarativeBase):
  """Base declarativa de todos los modelos ORM."""


def url_base_datos() -> str:
  """URL de conexión: `DATABASE_URL` o, si no está definida, SQLite local.

  El SQLite de respaldo vive en `backend/data/app.db` (gitignored).
  """
  url = os.environ.get("DATABASE_URL", "").strip()
  if url:
    return url
  return "sqlite:///{0}".format(DATABASE_SQLITE_RUTA)


_fabrica: Optional[sessionmaker] = None


def crear_fabrica(url: str) -> sessionmaker:
  """Crea una fábrica de sesiones para `url` y materializa las tablas."""
  kwargs = {}
  if url.startswith("sqlite"):
    kwargs["connect_args"] = {"check_same_thread": False}
  motor = create_engine(url, future=True, **kwargs)
  if url.startswith("sqlite"):
    DATABASE_SQLITE_RUTA.parent.mkdir(parents=True, exist_ok=True)
  from app.models import entidades  # noqa: F401
  Base.metadata.create_all(motor)
  _asegurar_columnas(motor)
  return sessionmaker(bind=motor, expire_on_commit=False, future=True)


def _asegurar_columnas(motor: engine.Engine) -> None:
  """Migración liviana e idempotente para bases creadas antes de un cambio.

  `create_all` no agrega columnas a tablas que ya existen. Para no obligar a
  borrar el volumen ante cada cambio de modelo, se agregan las columnas nuevas
  que faltan (hoy: `usuarios.bloqueado` y los campos de publicación del
  inmueble: `titulo`, `direccion`, `superficie`, `estado`, `fotos`).
  """
  inspector = inspect(motor)
  tablas = set(inspector.get_table_names())
  faltantes = []
  if "usuarios" in tablas:
    columnas = {c["name"] for c in inspector.get_columns("usuarios")}
    if "bloqueado" not in columnas:
      faltantes.append(
          "ALTER TABLE usuarios ADD COLUMN bloqueado BOOLEAN NOT NULL DEFAULT FALSE"
      )
  if "inmuebles" in tablas:
    columnas = {c["name"] for c in inspector.get_columns("inmuebles")}
    for nombre, tipo in (
        ("titulo", "VARCHAR(255)"),
        ("direccion", "VARCHAR(255)"),
        ("superficie", "FLOAT"),
        ("estado", "VARCHAR(64) DEFAULT 'publicado'"),
        ("fotos", "JSON"),
        ("tiene_patio", "BOOLEAN"),
        ("patio_cesped", "BOOLEAN"),
    ):
      if nombre not in columnas:
        faltantes.append(
            "ALTER TABLE inmuebles ADD COLUMN {0} {1}".format(nombre, tipo)
        )
  for sentencia in faltantes:
    with motor.begin() as conexion:
      conexion.execute(text(sentencia))


def motor() -> engine.Engine:
  """Motor de la fábrica global."""
  return fabrica().kw["bind"]


def fabrica() -> sessionmaker:
  """Fábrica de sesiones global del proceso (perezosa)."""
  global _fabrica
  if _fabrica is None:
    _fabrica = crear_fabrica(url_base_datos())
  return _fabrica


def fijar_fabrica(nueva: Optional[sessionmaker]):
  """Reemplaza la fábrica global (tests y scripts que aíslan la base)."""
  global _fabrica
  _fabrica = nueva


def inicializar() -> sessionmaker:
  """Asegura la fábrica global y el esquema. Devuelve la fábrica."""
  return fabrica()


@contextmanager
def sesion_de_trabajo(fab: Optional[sessionmaker] = None):
  """Sesión con commit/rollback. `fab` permite usar una fábrica aislada."""
  factory = fab or fabrica()
  sesion = factory()
  try:
    yield sesion
    sesion.commit()
  except Exception:
    sesion.rollback()
    raise
  finally:
    sesion.close()
