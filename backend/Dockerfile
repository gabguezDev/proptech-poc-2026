# syntax=docker/dockerfile:1
#
# Imagen del backend FastAPI.
#
#   python:3.9-slim  -> misma versión de Python que el proyecto (ver AGENTS.md:
#                       `Optional[...]`, sin PEP 604).
#   libgomp1         -> OpenMP que requiere LightGBM (en macOS se instala con
#                       `brew install libomp`; en la imagen ya viene).
#
# Dos etapas:
#   * dev   : código montado por el compose, uvicorn con --reload.
#   * prod  : código copiado en la imagen, uvicorn sin recarga.

FROM python:3.9-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Dependencias de sistema: libomp para LightGBM.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------- DEV ----------------------------
FROM base AS dev

# Se instala desde requirements.txt en cada build; en desarrollo el código se
# monta desde el host, así que los cambios de Python se ven al instante.
COPY requirements.txt ./
RUN pip install -r requirements.txt

# psutil no: uvicorn ya trae el reloader. Se expone el puerto del backend.
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------------------------- PROD ----------------------------
FROM base AS prod

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . ./
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
