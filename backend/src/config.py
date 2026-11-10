from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DEFAULT_DATA_PATH = DATA_DIR / "mock_properties.json"

ARTIFACTS_DIR = BASE_DIR / "artifacts"
LGBM_MODEL_PATH = ARTIFACTS_DIR / "lgbm_recommender.pkl"

DATABASE_SQLITE_RUTA = DATA_DIR / "app.db"

FEATURE_COLS = [
    "distancia_trabajo",
    "margen_presupuesto",
    "match_cochera",
    "tiene_balcon",
    "es_silencioso",
    "proximidad_salud",
    "proximidad_verde",
    "match_garantia",
]

KM_POR_GRADO = 111.0

DISTANCIA_CERCA_METROS = 500.0
DISTANCIA_MEDIA_METROS = 1000.0

PROXIMIDAD_ESCALA = {
    "cercano": 1.0,
    "mediano": 0.5,
    "lejano": 0.0,
}

MONEDAS_INDISTINTAS = ("indistinta", "cualquiera", "any", "")

DIMENSIONES_SCORE = [
    "precio",
    "ubicacion",
    "habitos_confort",
    "amenities",
    "garantias",
]

PESOS_USUARIO_DEFAULT = {
    "precio": 0.30,
    "ubicacion": 0.30,
    "habitos_confort": 0.15,
    "amenities": 0.15,
    "garantias": 0.10,
}

SCORE_SCALE_MAX = 100.0

PENALIZACION_COMPLETITUD_MIN = 0.5

BOOST_FEEDBACK_DEFAULT = 1.10

DEFAULT_TOP_K = 5

API_TITLE = "PropTech Recommendation API"
API_DESCRIPTION = (
    "API para el sistema de recomendación inteligente de inmuebles"
)
API_VERSION = "0.2.0"
