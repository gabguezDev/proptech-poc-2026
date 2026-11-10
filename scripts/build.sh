#!/usr/bin/env bash
# Reconstruye las imágenes del stack.
#
#   ./scripts/build.sh            -> rebuild de las imágenes de desarrollo
#   ./scripts/build.sh --prod     -> build de producción (sin mounts, `next build`)
#   ./scripts/build.sh backend    -> rebuild solo del backend
#   ./scripts/build.sh frontend   -> rebuild solo del frontend
#   ./scripts/build.sh --no-cache backend
#
# Cuándo usarlo:
#   - Cambió `backend/requirements.txt` (dependencias Python).
#   - Cambió `frontend/package.json` o `package-lock.json` (node_modules).
#   - Se modificó un Dockerfile o el `next.config.ts`.
#   - Querés validar el artefacto final con `--prod`.
#
# El código de la app NO requiere rebuild en modo dev: está montado, con
# hot-reload (uvicorn --reload / next dev). Basta ./scripts/dev.sh.

set -euo pipefail
cd "$(dirname "$0")/.."

SIN_CACHE=()
SERVICIOS=()
ETAQUETA="dev"

for arg in "$@"; do
  case "$arg" in
    --prod)
      ETAQUETA="prod"
      ;;
    --no-cache)
      SIN_CACHE+=(--no-cache)
      ;;
    backend|frontend|db)
      SERVICIOS+=("$arg")
      ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ "$ETAQUETA" = "prod" ]; then
  echo "→ Build de producción (backend: uvicorn sin recarga, frontend: next build)…"
  # `--parallel` acelera cuando se construyen los dos a la vez.
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build \
    "${SIN_CACHE[@]+"${SIN_CACHE[@]}"}" ${SERVICIOS[@]+"${SERVICIOS[@]}"}
  echo
  echo "Levantar en producción:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
else
  echo "→ Reconstruyendo imágenes de desarrollo…"
  docker compose build "${SIN_CACHE[@]+"${SIN_CACHE[@]}"}" ${SERVICIOS[@]+"${SERVICIOS[@]}"}
  echo
  echo "Levantar:  ./scripts/dev.sh"
fi
