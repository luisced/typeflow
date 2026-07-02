#!/usr/bin/env bash
# Usage:
#   ./deploy.sh          build images locally from this checkout
#   ./deploy.sh --pull   pull prebuilt release images from GHCR (faster,
#                        no build tools needed; pin with TYPEFLOW_VERSION in .env)
set -e

ENV_FILE=".env"
EXAMPLE=".env.example"
COMPOSE_FILE="docker/docker-compose.yml"
MODE="build"

if [ "${1:-}" = "--pull" ]; then
  MODE="pull"
  COMPOSE_FILE="docker/docker-compose.prod.yml"
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from example - edit it before re-running."
  exit 1
fi

# Read a var from the env file — active line takes priority, then commented line.
read_env() {
  local key="$1" default="$2"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '[:space:]')
  if [ -z "$val" ]; then
    val=$(grep -E "^#\s*${key}=" "$ENV_FILE" | tail -1 | sed 's/^#\s*//' | cut -d= -f2- | tr -d '[:space:]')
  fi
  echo "${val:-$default}"
}

API_PORT=$(read_env API_PORT 8000)
WEB_PORT=$(read_env WEB_PORT 3000)

check_port() {
  local port=$1
  local name=$2
  if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Error: port $port ($name) is already in use."
    echo "Set $name=$port in $ENV_FILE (uncomment the line) and change it, then re-run."
    exit 1
  fi
}

check_port "$API_PORT" "API_PORT"
check_port "$WEB_PORT" "WEB_PORT"

if [ "$MODE" = "pull" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
fi
echo "TypeFlow is up. Frontend -> http://localhost:${WEB_PORT}  API -> http://localhost:${API_PORT}"
