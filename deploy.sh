#!/usr/bin/env bash
set -e

ENV_FILE=".env"
EXAMPLE=".env.example"

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

docker compose -f docker/docker-compose.yml --env-file "$ENV_FILE" \
  -e API_PORT="$API_PORT" -e WEB_PORT="$WEB_PORT" \
  up -d --build
echo "TypeFlow is up. Frontend -> http://localhost:${WEB_PORT}  API -> http://localhost:${API_PORT}"
