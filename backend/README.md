# TypeFlow Sync Backend

FastAPI service for JWT auth and typing-history sync. See [the design spec](../docs/superpowers/specs/2026-06-09-typeflow-sync-backend.md) for architecture details.

## Local development

Uses [uv](https://docs.astral.sh/uv/) for dependency management (`uv.lock` is committed).

```bash
cd backend
uv sync              # creates .venv from uv.lock (includes dev deps)
cp .env.example .env   # edit secrets as needed
make dev               # http://localhost:8000 — uvicorn --reload
```

From the repo root: `npm run dev:backend` (same as `make dev`).

Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh` (or `npm run onboard` from repo root).

Tests use in-memory SQLite (no Postgres required):

```bash
make test              # uv run pytest
```

CI runs backend pytest and frontend vitest/lint on every push (see `.github/workflows/ci.yml`).

### Postgres + migrations

```bash
# Start only Postgres from compose
docker compose up -d postgres

export TYPEFLOW_DATABASE_URL=postgresql+asyncpg://typeflow:change-me@localhost:5432/typeflow
make upgrade
make dev
```

## Docker deploy

```bash
# onboard.sh writes backend/.env.docker, or copy .env.docker.example
docker compose --env-file .env.docker up -d --build
curl http://localhost:8080/healthz   # default API_PORT in .env.docker.example
```

### Docker with hot reload (dev)

Default for `./scripts/onboard.sh`. Mounts `./app` into the container and runs uvicorn with `--reload` (single worker):

```bash
make docker-dev-d      # detached (recommended day-to-day)
make docker-dev        # foreground with logs
# or from repo root:
npm run dev:docker
```

Edit files under `backend/app/` and the API restarts automatically.

Production (single worker, no reload, no bind mount):

```bash
make docker-prod
# or onboard with: ./scripts/onboard.sh --prod-docker
```

Single worker keeps in-memory rate limits accurate. Scale vertically or add Redis-backed limits before running multiple workers.

`POSTGRES_PASSWORD` is fixed when the `pgdata` volume is first created. If you change it later, run `docker compose --env-file .env.docker down -v` to wipe the volume and start fresh.

Services: **api** (uvicorn, 1 worker) → **postgres:16**. The API container includes a `/healthz` healthcheck. Override the host port with `API_PORT`.

Put TLS in front of the API with your own reverse proxy (nginx, Traefik, Cloudflare, etc.) if needed.

Migrations run automatically on container start via `entrypoint.sh`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `TYPEFLOW_DATABASE_URL` | Async SQLAlchemy URL (`postgresql+asyncpg://...` or SQLite) |
| `TYPEFLOW_JWT_SECRET` | HS256 signing secret (32+ random bytes in production) |
| `TYPEFLOW_ENV` | `development` or `production` — weak JWT secrets fail startup in production |
| `TYPEFLOW_CORS_ORIGINS` | JSON array of allowed frontend origins |
| `TYPEFLOW_COOKIE_SECURE` | `true` in production (HTTPS); `false` for local HTTP |
| `TYPEFLOW_RATE_LIMIT_ENABLED` | Rate-limit `/auth/*` (disabled in pytest) |
| `TYPEFLOW_PASSWORD_RESET_MINUTES` | Password reset token TTL (default `30`) |
| `TYPEFLOW_LOG_LEVEL` | Log level (default `INFO`) |
| `TYPEFLOW_LOG_COLOR` | ANSI colors in logs (default `true`) |
| `TYPEFLOW_LOG_ACCESS` | Request access logging middleware (default `true`) |
| `TYPEFLOW_LOG_EXCLUDE_PATHS` | JSON array of paths to skip in access logs (default `["/healthz"]`) |
| `POSTGRES_PASSWORD` | Postgres password (compose) |
| `API_PORT` | Host port mapped to the API container (default `8000`) |

## Backups

Nightly `pg_dump` via cron on the VPS:

```cron
0 2 * * * /opt/typeflow/backend/scripts/backup.sh >> /var/log/typeflow-backup.log 2>&1
```

Set `BACKUP_DIR`, `POSTGRES_CONTAINER`, and `RETAIN_DAYS` as needed.

## API overview

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | — |
| POST | `/auth/login` | — |
| POST | `/auth/refresh` | refresh cookie |
| POST | `/auth/logout` | refresh cookie |
| POST | `/auth/forgot-password` | — |
| POST | `/auth/reset-password` | — |
| GET | `/me` | Bearer |
| DELETE | `/me` | Bearer |
| POST | `/runs/batch` | Bearer |
| GET | `/runs?after=&limit=` | Bearer |
| GET | `/runs/summary?after=&limit=` | Bearer |
| GET | `/runs/{run_id}` | Bearer |
| DELETE | `/runs` | Bearer |
| GET | `/healthz` | — |

Password reset is API-only for now: `forgot-password` always returns `202` (no email sent yet); use the token from your reset flow once email is wired up.
