#!/usr/bin/env bash
# Levanta el stack completo en modo desarrollo (base + backend + frontend).
#
#   ./scripts/dev.sh              -> sube y muestra el estado
#   ./scripts/dev.sh --rebuild    -> sube reconstruyendo las imágenes
#   ./scripts/dev.sh --logs       -> sube y queda mostrando los logs
#
# No reconstruye por defecto: así arranca en segundos. Para eso está build.sh.
# El código queda montado, con hot-reload en ambos servidores.

set -euo pipefail
cd "$(dirname "$0")/.."

MODO="up"
Arguments=()
for arg in "$@"; do
  case "$arg" in
    --rebuild)
      Arguments+=(--build)
      ;;
    --logs)
      MODO="logs"
      ;;
    -h|--help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $arg" >&2
      exit 1
      ;;
  esac
done

if [ ! -f .env ]; then
  echo "No existe .env: se usan los valores por defecto (ver .env.example)." >&2
fi

echo "→ Levantando db + backend + frontend…"
docker compose up -d "${Arguments[@]+"${Arguments[@]}"}"

echo
docker compose ps
echo
echo "  Frontend (Next.js + BFF): http://localhost:${FRONTEND_PORT:-3000}"
echo "  Backend   (FastAPI):      http://localhost:${BACKEND_PORT:-8000}/docs"
echo "  Base de datos (PostgreSQL): localhost:${POSTGRES_PORT:-5433}"
echo
echo "Cuentas sembradas al primer arranque:"
echo "  admin@proptech.local / dueno@ / agente@ / buscador@  (ver .env.example)"
echo
echo "Logs:  ./scripts/dev.sh --logs   |   Detener: docker compose down"

if [ "$MODO" = "logs" ]; then
  echo
  docker compose logs -f
fi
