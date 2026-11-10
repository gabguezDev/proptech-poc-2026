"""Etiquetado de fotos por ambiente (sección del inmueble).

Cada foto de una publicación puede identificarse con el ambiente que muestra
(living, cocina, dormitorio 2, baño 1...). La cobertura de secciones alimenta
el score de carga (`completeness.py`) y la galería puede ordenar/filtrar por
ambiente.

Reglas:
  - `ambiente` es un enum cerrado (`AMBIENTES_FOTOS`).
  - `dormitorio` y `bano` llevan `numero` (1 = principal, 2 = secundario...),
    acotado por lo que declara el inmueble (`cantidad_habitaciones` /
    `cantidad_banos`), para no "inventar" ambientes.
  - Una foto puede llevar 2 etiquetas (living + comedor): se almacena con la
    principal en `ambiente` y la secundaria en `ambiente2`. La cobertura
    cuenta ambas.
  - Máximo `MAX_FOTOS_POR_SECCION` fotos por sección (ambiente + numero).
  - Las fotos legacy (solo URL, sin etiqueta) cuentan como una única sección
    ("otros") y no computan para el tope por sección.
"""

AMBIENTES_FOTOS = (
  "living",
  "comedor",
  "cocina",
  "dormitorio",
  "bano",
  "lavadero",
  "patio",
  "patio_interno",
  "balcon",
  "cochera",
  "vista",
  "amenities",
  "otros",
)

ETIQUETAS = {
  "living": "Living",
  "comedor": "Comedor",
  "cocina": "Cocina",
  "dormitorio": "Dormitorio",
  "bano": "Baño",
  "lavadero": "Lavadero",
  "patio": "Patio",
  "patio_interno": "Patio interno",
  "balcon": "Balcón",
  "cochera": "Cochera",
  "vista": "Vista",
  "amenities": "Amenities",
  "otros": "Otros",
}

AMBIENTES_CON_NUMERO = ("dormitorio", "bano")

MAX_FOTOS_POR_SECCION = 2

UMBRAL_COBERTURA_SECCIONES = 6


def secciones_foto(foto):
  """Secciones `(ambiente, numero)` que cubre una foto (una o dos).

  Las fotos legacy (solo URL) cubren solo ("otros", None).
  """
  if isinstance(foto, dict):
    secciones = {(foto.get("ambiente") or "otros", foto.get("numero"))}
    if foto.get("ambiente2"):
      secciones.add((foto["ambiente2"], foto.get("numero2")))
    return secciones
  return {("otros", None)}


def secciones_cubiertas(fotos):
  """Conjunto de secciones distintas con al menos una foto."""
  cubiertas = set()
  for foto in (fotos or []):
    cubiertas |= secciones_foto(foto)
  return cubiertas


def contar_fotos_en_seccion(fotos, ambiente, numero):
  """Cantidad de fotos etiquetadas en una sección (las legacy no cuentan)."""
  objetivo = (ambiente, numero)
  return sum(
      1
      for foto in (fotos or [])
      if isinstance(foto, dict) and objetivo in secciones_foto(foto)
  )


def etiqueta_seccion(ambiente, numero):
  """Nombre legible de una sección: "Dormitorio 2", "Living"..."""
  base = ETIQUETAS.get(ambiente, "Otros")
  if isinstance(numero, int) and numero >= 1:
    return "{0} {1}".format(base, numero)
  return base


def error_etiqueta(ambiente, numero, inmueble):
  """Valida la etiqueta de una foto; devuelve el mensaje de error o None.

  `inmueble` aporta `cantidad_habitaciones` / `cantidad_banos` para acotar el
  número de dormitorio/baño (sin esos datos solo se exige >= 1).
  """
  if ambiente not in AMBIENTES_FOTOS:
    return "Ambiente no válido: {0} (usá: {1})".format(
        ambiente, ", ".join(AMBIENTES_FOTOS)
    )
  if ambiente in AMBIENTES_CON_NUMERO:
    if numero is None or numero < 1:
      return "El número de {0} es obligatorio (1 = principal)".format(
          ETIQUETAS[ambiente].lower()
      )
    tope = None
    if ambiente == "dormitorio":
      tope = inmueble.get("cantidad_habitaciones")
    else:
      tope = inmueble.get("cantidad_banos")
    if tope is not None and numero > tope:
      unidad = "dormitorios" if ambiente == "dormitorio" else "baños"
      return "El inmueble declara {0} {1}; el número {2} no existe".format(
          tope, unidad, numero
      )
  return None
