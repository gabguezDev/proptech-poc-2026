"""Configuración de pytest para el monorepo.

El backend vive en `backend/` y sus módulos se importan como `src.*` y `main`
tal como cuando el proyecto era de una sola carpeta. Este `conftest.py` agrega
`backend/` al `sys.path` para poder correr `pytest` desde la raíz del repositorio
sin instalar el paquete ni fijar `PYTHONPATH` a mano.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent / "backend"

if str(BACKEND_DIR) not in sys.path:
  sys.path.insert(0, str(BACKEND_DIR))
