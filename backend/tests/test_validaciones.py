"""Tests de la validación de afirmaciones refutadas con foto y ubicación."""

import pytest

from app.repositories.validacion_repository import RepositorioValidaciones
from app.services.inmueble_service import ServicioInmuebles
from app.repositories.inmueble_repository import RepositorioInmuebles
from app.utils.exif import gps_de_foto


def test_gps_de_foto_sin_exif():
  assert gps_de_foto(b"no es una imagen") is None


def _foto_jpeg_con_gps(tmp_path):
  from PIL import Image

  ruta = tmp_path / "punto.jpg"
  imagen = Image.new("RGB", (8, 8), color="red")
  exif = imagen.getexif()
  gps_ifd = 0x8825
  exif[gps_ifd] = {
      1: "S",
      2: (27.0, 28.0, 0.0),
      3: "W",
      4: (58.0, 49.0, 0.0),
  }
  imagen.save(ruta, exif=exif)
  return ruta.read_bytes()


def test_gps_de_foto_con_exif(tmp_path):
  resultado = gps_de_foto(_foto_jpeg_con_gps(tmp_path))
  assert resultado is not None
  lat, lon = resultado
  assert -27.47 < lat < -27.46
  assert -58.84 < lon < -58.81


def test_repositorio_validaciones(fabrica):
  repo = RepositorioValidaciones(fabrica=fabrica)
  creada = repo.crear(101, "distancia_hospital_m", "http://x/foto.jpg",
                      -27.46, -58.83, 800, 800, "validado")
  assert creada["resultado"] == "validado"
  assert repo.listar_por_inmueble(101)[0]["detalle"] == "distancia_hospital_m"
