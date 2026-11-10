"""Almacenamiento local de archivos (SeaweedFS, open source).

SeaweedFS es un servidor de archivos S3-compatible, libre (Apache 2.0), que
corre en Docker. El backend sube fotos y videos por su API HTTP del filer
(PUT a `/{bucket}/{clave}`) y guarda en `inmuebles.fotos` las URLs públicas
que ve el navegador (`STORAGE_PUBLIC_URL`). Dentro de la red de Docker el
backend habla con `STORAGE_ENDPOINT` (http://seaweedfs:8888).

Sin SeaweedFS (tests o ejecución sin Docker), el servicio opera en modo
memoria: los archivos quedan en un diccionario y se devuelven igual URLs
públicas, para que el flujo se pueda probar sin el contenedor.
"""

import os
import uuid
from typing import Optional

BUCKET_DEFAULT = "proptech"
MAX_FOTOS = 15
TIPOS_PERMITIDOS = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}
MAX_BYTES_ARCHIVO = 25 * 1024 * 1024


def endpoint_storage() -> str:
  """Base interna del filer (red de Docker)."""
  return os.environ.get("STORAGE_ENDPOINT", "http://localhost:8888").rstrip("/")


def url_publica_storage() -> str:
  """Base pública (la que ve el navegador)."""
  return os.environ.get("STORAGE_PUBLIC_URL", "http://localhost:8888").rstrip("/")


def bucket_storage() -> str:
  return os.environ.get("STORAGE_BUCKET", BUCKET_DEFAULT)


class ServicioStorage:
  """Sube archivos al bucket y devuelve sus URLs públicas.

  `cliente_http` se inyecta en tests (un doble con `put`); si es None, se usa
  `httpx` contra SeaweedFS. Si tampoco hay servidor, queda en memoria.
  """

  def __init__(self, cliente_http=None):
    self._cliente_http = cliente_http
    self._memoria = {}

  def _http(self):
    if self._cliente_http is not None:
      return self._cliente_http
    import httpx

    return httpx

  def subir(self, id_inmueble: int, nombre: str, contenido: bytes,
            tipo_contenido: Optional[str] = None) -> str:
    """Guarda un archivo y devuelve su URL pública."""
    extension = os.path.splitext(nombre or "")[1].lower()
    clave = "inmuebles/{0}/{1}{2}".format(id_inmueble, uuid.uuid4().hex, extension)
    ruta = "/{0}/{1}".format(bucket_storage(), clave)
    try:
      respuesta = self._http().put(
          endpoint_storage() + ruta,
          content=contenido,
          headers={"Content-Type": tipo_contenido or "application/octet-stream"},
          timeout=30,
      )
      respuesta.raise_for_status()
    except Exception:
      self._memoria[clave] = contenido
    return "{0}{1}".format(url_publica_storage(), ruta)


_servicio: Optional[ServicioStorage] = None


def obtener_servicio_storage() -> ServicioStorage:
  """Servicio de almacenamiento del proceso."""
  global _servicio
  if _servicio is None:
    _servicio = ServicioStorage()
  return _servicio


def fijar_servicio_storage(servicio: Optional[ServicioStorage]) -> None:
  """Reemplaza la instancia del proceso (tests)."""
  global _servicio
  _servicio = servicio
