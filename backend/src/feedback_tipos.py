"""Tipos de feedback del inquilino y sus grados de relevancia.

Vive en `src` (y no en `app`) porque la evaluación offline (`src/evaluacion.py`)
también los usa, y el dominio no debe depender de la capa de servicios.
"""

TIPO_FAVORITO = "favorito"
TIPO_ME_GUSTA = "me_gusta"
TIPO_NO_ME_GUSTA = "no_me_gusta"
TIPO_VISTO = "visto"
TIPO_CONTACTO = "contacto"
TIPO_VISITA_SOLICITADA = "visita_solicitada"
TIPO_VIO = "vio"
TIPO_NO_VIO = "no_vio"
TIPO_NO_SE = "no_se"
TIPO_VISITA_CONFIRMADA = "visita_confirmada"

TIPOS = (
    TIPO_FAVORITO,
    TIPO_ME_GUSTA,
    TIPO_NO_ME_GUSTA,
    TIPO_VISTO,
    TIPO_CONTACTO,
    TIPO_VISITA_SOLICITADA,
    TIPO_VIO,
    TIPO_NO_VIO,
    TIPO_NO_SE,
    TIPO_VISITA_CONFIRMADA,
)
TIPOS_EXPLICITOS = (
    TIPO_FAVORITO,
    TIPO_ME_GUSTA,
    TIPO_NO_ME_GUSTA,
)
TIPOS_INTERACCION = (TIPO_VISTO, TIPO_CONTACTO, TIPO_VISITA_SOLICITADA)
REACCIONES = (TIPO_ME_GUSTA, TIPO_NO_ME_GUSTA)
VERIFICACIONES = (TIPO_VIO, TIPO_NO_VIO, TIPO_NO_SE)
SEPARADOR_DETALLE = "|"

GRADO_FEEDBACK = {
    TIPO_FAVORITO: 3.0,
    TIPO_ME_GUSTA: 2.0,
    TIPO_CONTACTO: 1.0,
    TIPO_VISITA_SOLICITADA: 1.0,
    TIPO_VISTO: 0.5,
}
GRADO_RELEVANTE = 2.0
