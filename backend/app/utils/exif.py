"""Extracción del GPS de una foto (EXIF).

Primero se intenta leer la coordenada del archivo; si no la tiene, el
llamante usa la ubicación enviada por el usuario.
"""

from typing import Optional, Tuple


def gps_de_foto(contenido: bytes) -> Optional[Tuple[float, float]]:
  """Devuelve (lat, lon) del GPS EXIF de la foto, o None si no lo tiene."""
  try:
    from io import BytesIO

    from PIL import Image
    from PIL.ExifTags import GPSTAGS, TAGS

    imagen = Image.open(BytesIO(contenido))
    exif = imagen.getexif()
    if not exif:
      return None
    gps_info = exif.get_ifd(0x8825) if hasattr(exif, "get_ifd") else None
    if gps_info is None:
      for tag_id, valor in exif.items():
        if TAGS.get(tag_id) == "GPSInfo":
          gps_info = valor
          break
    if not gps_info:
      return None

    def _a_decimal(valores, referencia):
      grados, minutos, segundos = [float(v) for v in valores]
      decimal = grados + minutos / 60 + segundos / 3600
      if referencia in ("S", "W"):
        decimal = -decimal
      return decimal

    gps = {GPSTAGS.get(tag, tag): valor for tag, valor in gps_info.items()}
    lat = _a_decimal(gps["GPSLatitude"], gps["GPSLatitudeRef"])
    lon = _a_decimal(gps["GPSLongitude"], gps["GPSLongitudeRef"])
    return lat, lon
  except Exception:
    return None
