#!/usr/bin/env bash
set -e

ENV_FILE="backend/.env.docker"
EXAMPLE="backend/.env.docker.example"

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE" "$ENV_FILE"
  echo "Created $ENV_FILE from example — edit it before re-running."
  exit 1
fi

docker compose -f docker/docker-compose.yml --env-file "$ENV_FILE" up -d --build
echo "TypeFlow is up. Frontend → http://localhost:${WEB_PORT:-3000}  API → http://localhost:${API_PORT:-8000}"
