# Contributing

## Requirements

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python)
- [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/installation)
- Docker (optional - only needed for the Postgres dev flow)

## Setup

Copy the env file once at the project root - it's shared by the backend, frontend, and Docker Compose:

```bash
cp .env.example .env   # edit if needed - SQLite works out of the box
```

**Backend**

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

**Frontend** (separate terminal)

```bash
cd frontend
pnpm install
pnpm dev
```

The frontend auto-selects a free port starting at 3000 and prints the URL on startup.

## Running tests

```bash
# Backend
cd backend && uv run pytest -q

# Frontend
cd frontend && pnpm test
```

CI runs both on every push and pull request.

## Project structure

```
typeflow/
├── backend/      Python / FastAPI
│   ├── app/
│   │   ├── auth/       Auth, JWT, refresh tokens
│   │   ├── core/       Config, DB, middleware, security
│   │   ├── keyboards/  Keyboard tracking
│   │   └── runs/       Typing runs, stats, leaderboard
│   ├── alembic/    Database migrations
│   └── tests/
├── frontend/     Next.js (App Router)
│   ├── app/        Pages and layouts
│   ├── components/ React components
│   └── lib/        Business logic, API client, hooks
└── docker/       Dockerfiles and Compose files
```

## Branch naming

Branches follow `<type>(<scope>)/<short-description>`, kebab-case:

```
feat(auth)/guest-mode
fix(leaderboard)/timezone-bug
chore(deploy)/pin-pnpm-version
docs(readme)/self-hosting-steps
```

`type` is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. `scope` is the
area touched (`auth`, `runs`, `leaderboard`, `deploy`, `docker`, etc.) - omit it
only when a change is truly cross-cutting. Keep `short-description` a few words,
no issue numbers.

## Pull requests

- Keep PRs focused - one concern per PR
- Backend: add or update tests in `backend/tests/` for any changed behaviour
- Frontend: add or update tests in the relevant `*.test.ts(x)` files
- Run `pnpm lint` before opening a frontend PR

## Migrations

If your backend change requires a schema change:

```bash
cd backend
uv run alembic revision --autogenerate -m "short description"
# review the generated file in alembic/versions/
uv run alembic upgrade head
```

Commit the migration file alongside the model change.
