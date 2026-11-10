"""Perfil y feedback de demostración del inquilino.

Se siembran para la cuenta demo de seeker (`buscador@proptech.local`), de modo que
se pueda mostrar el feedback y la evaluación con feedback real sin cargar datos
a mano.
"""

from src.feedback_tipos import (
    TIPO_CONTACTO,
    TIPO_FAVORITO,
    TIPO_ME_GUSTA,
    TIPO_NO_ME_GUSTA,
    TIPO_VISTO,
)

PERFIL_DEMO_INQUILINO = {
    "presupuesto_max": 250000,
    "moneda_preferida": "ARS",
    "tiene_garantia_recibo": True,
    "tiene_garantia_prop": False,
    "tipologia_preferida": "departamento",
    "cant_dormitorios_min": 1,
    "cant_banos_min": 1,
    "tiene_mascota": True,
    "tipo_mascota": "perro",
    "requiere_cochera": False,
    "prefiere_cochera": True,
    "requiere_balcon": False,
    "hace_home_office": True,
    "nivel_tolerancia_ruido": "bajo",
    "frecuencia_cocina": "media",
    "frecuencia_lavado": "media",
    "hace_deporte": True,
    "medio_transporte_principal": "auto",
    "lat_trabajo": -27.469,
    "lon_trabajo": -58.830,
    "distancia_max_trabajo_km": 5.0,
    "pesos_usuario": {
        "precio": 0.30,
        "ubicacion": 0.30,
        "habitos_confort": 0.15,
        "amenities": 0.15,
        "garantias": 0.10,
    },
}

FEEDBACK_DEMO_INQUILINO = [
    (101, TIPO_FAVORITO),
    (104, TIPO_FAVORITO),
    (106, TIPO_ME_GUSTA),
    (102, TIPO_NO_ME_GUSTA),
    (103, TIPO_VISTO),
    (105, TIPO_VISTO),
    (107, TIPO_CONTACTO),
]
