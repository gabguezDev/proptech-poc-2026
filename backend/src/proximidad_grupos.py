"""Grupos de proximidad: para no abrumar, los puntos de interés se agrupan.

Cada grupo se informa/estima con una sola distancia (la menor de sus
miembros) y la verificación del visitante es por grupo, no por punto.
"""

GRUPOS_PROXIMIDAD = {
    "comercio_diario": ("distancia_quiosco_m", "distancia_autoservicio_m"),
    "compras": ("distancia_supermercado_m", "distancia_hipermercado_m"),
    "verde": ("distancia_plaza_m", "distancia_parque_m"),
    "educacion_basica": ("distancia_escuela_m", "distancia_colegio_m"),
    "educacion_superior": (
        "distancia_instituto_terciario_m",
        "distancia_universidad_m",
    ),
    "salud": (
        "distancia_caps_m",
        "distancia_hospital_m",
        "distancia_clinica_m",
    ),
    "estacionamiento": ("distancia_estacionamiento_m",),
}

ETIQUETAS_GRUPOS = {
    "comercio_diario": "Quiosco / Autoservicio",
    "compras": "Supermercado / Hipermercado",
    "verde": "Plaza / Parque",
    "educacion_basica": "Escuela / Colegio",
    "educacion_superior": "Instituto terciario / Universidad",
    "salud": "CAPS / Hospital / Clínica",
    "estacionamiento": "Estacionamiento medido",
}


def distancia_grupo(proximidad, grupo):
  """Distancia declarada del grupo: la menor de sus miembros (o None)."""
  if not proximidad:
    return None
  distancias = [
      proximidad[clave]
      for clave in GRUPOS_PROXIMIDAD.get(grupo, ())
      if isinstance(proximidad.get(clave), (int, float))
  ]
  return min(distancias) if distancias else None


def clave_campo(detalle):
  """Campo de proximidad a validar: admite clave cruda o nombre de grupo."""
  if detalle in GRUPOS_PROXIMIDAD:
    return GRUPOS_PROXIMIDAD[detalle][0]
  return detalle if detalle.startswith("distancia_") else "distancia_{0}_m".format(detalle)
