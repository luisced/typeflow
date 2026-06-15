# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `TYPEFLOW_REGISTRATION_OPEN` config flag - set to `false` to close public signups while keeping existing accounts active
- `docker/Dockerfile.frontend` - production Docker image for the Next.js frontend
- `docker/docker-compose.yml` now includes the `web` service so the full stack (Postgres + API + frontend) starts with a single command
- `deploy.sh` and `deploy.ps1` - one-command deploy scripts for Linux/macOS and Windows respectively; auto-create `.env.docker` from the example on first run
- MIT license

### Changed
- Project restructured into `frontend/`, `backend/`, and `docker/` top-level directories
- `frontend/next.config.mjs` - enabled `output: "standalone"` for Docker-compatible builds
- `backend/Makefile` - docker targets updated to reference files in `docker/`
- `.github/workflows/ci.yml` - frontend job now runs from `frontend/` working directory

---

## [0.1.0] - 2026-06-14

### Added
- Typing test engine with time and word-count modes
- Per-key accuracy heatmap and WPM history charts
- JWT authentication with refresh-token rotation and password reset
- Run sync across devices
- Global and monthly leaderboards
- Keyboard tracking (name + layout per keyboard)
- FastAPI backend with async SQLAlchemy, Alembic migrations, and SQLite/PostgreSQL support
- Rate limiting on auth endpoints
- Docker Compose setup for backend + Postgres
