import json
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_PATH = BASE_DIR / "data" / "mock_properties.json"


def load_mock_properties(file_path: Path = DEFAULT_DATA_PATH) -> pd.DataFrame:
  """Carga el catálogo sintético de propiedades desde el archivo JSON de forma segura."""
  if not file_path.exists():
    raise FileNotFoundError(
        f"No se encontró el archivo de datos en la ruta: {file_path}"
    )

  with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

  return pd.DataFrame(data)