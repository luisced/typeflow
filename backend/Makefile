.PHONY: sync dev docker-dev docker-dev-d docker-prod test migrate upgrade

COMPOSE_DEV = -f ../docker/docker-compose.yml -f ../docker/docker-compose.dev.yml --env-file ../.env

sync:
	uv sync

dev:
	uv run uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000 --no-access-log

docker-dev:
	docker compose $(COMPOSE_DEV) up --build

docker-dev-d:
	docker compose $(COMPOSE_DEV) up -d --build

docker-prod:
	docker compose -f ../docker/docker-compose.yml --env-file ../.env up -d --build

test:
	uv run pytest -q

migrate:
	uv run alembic revision --autogenerate -m "$(msg)"

upgrade:
	uv run alembic upgrade head
