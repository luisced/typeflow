#!/usr/bin/env bash
set -e

ENV_FILE="backend/.env.docker"
EXAMPLE="backend/.env.docker.example"

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from example - edit it before re-running."
  exit 1
fi

# Read ports from env file, fall back to defaults
API_PORT=$(grep -E '^API_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
WEB_PORT=$(grep -E '^WEB_PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '[:space:]')
API_PORT=${API_PORT:-8000}
WEB_PORT=${WEB_PORT:-3000}

check_port() {
  local port=$1
  local name=$2
  if lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Error: port $port ($name) is already in use."
    echo "Change $name in $ENV_FILE and re-run."
    exit 1
  fi
}

check_port "$API_PORT" "API_PORT"
check_port "$WEB_PORT" "WEB_PORT"

docker compose -f docker/docker-compose.yml --env-file "$ENV_FILE" up -d --build
echo "TypeFlow is up. Frontend -> http://localhost:${WEB_PORT}  API -> http://localhost:${API_PORT}"
