from src.config import DISTANCIA_CERCA_METROS, DISTANCIA_MEDIA_METROS

CERCANO = "cercano"
MEDIANO = "mediano"
LEJANO = "lejano"
DESCONOCIDO = "desconocido"


def clasificar_distancia(metros):
  """Clasifica una distancia en metros según los umbrales de config.

  - < DISTANCIA_CERCA_METROS (500 m)  -> "cercano"
  - < DISTANCIA_MEDIA_METROS (1000 m) -> "mediano"
  - >= DISTANCIA_MEDIA_METROS (1000 m)-> "lejano"
  - None                              -> "desconocido"
  """
  if metros is None:
    return DESCONOCIDO
  if metros < DISTANCIA_CERCA_METROS:
    return CERCANO
  if metros < DISTANCIA_MEDIA_METROS:
    return MEDIANO
  return LEJANO


def clasificar_proximidad(proximidad):
  """Devuelve {punto_de_interes: categoria} a partir del bloque de distancias.

  Ej: {"distancia_quiosco_m": 120, ...} -> {"quiosco": "cercano", ...}
  """
  return {
      campo.replace("distancia_", "").replace("_m", ""): clasificar_distancia(
          valor
      )
      for campo, valor in proximidad.items()
  }


import math

RADIO_TIERRA_KM = 6371.0


def haversine_km(lat1, lon1, lat2, lon2):
  """Distancia geodésica en km entre dos coordenadas (fórmula de Haversine)."""
  lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
  dlat = lat2 - lat1
  dlon = lon2 - lon1
  a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
  return 2 * RADIO_TIERRA_KM * math.asin(min(1.0, math.sqrt(a)))


def punto_en_radio(lat, lon, centro_lat, centro_lon, radio_km):
  """¿El punto cae dentro del círculo de `radio_km` alrededor del centro?"""
  return haversine_km(lat, lon, centro_lat, centro_lon) <= radio_km


def punto_en_poligono(lat, lon, puntos):
  """¿El punto cae dentro del polígono (método de ray casting)?

  `puntos` es una lista de dicts `{lat, lon}` (o `{latitud, longitud}`).
  Con menos de 3 puntos no hay interior: devuelve False.
  """
  def _coords(punto):
    if isinstance(punto, dict):
      return punto.get("lat", punto.get("latitud")), punto.get("lon", punto.get("longitud"))
    return getattr(punto, "lat", None), getattr(punto, "lon", None)

  vertices = [_coords(p) for p in puntos]
  vertices = [(la, lo) for la, lo in vertices if la is not None and lo is not None]
  if len(vertices) < 3:
    return False
  dentro = False
  j = len(vertices) - 1
  for i, (xi, yi) in enumerate(vertices):
    xj, yj = vertices[j]
    if ((yi > lon) != (yj > lon)) and (
        lat < (xj - xi) * (lon - yi) / (yj - yi) + xi
    ):
      dentro = not dentro
    j = i
  return dentro
