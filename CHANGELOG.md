# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.2.0] - 2026-07-02

### Added
- App version shown in the footer, read from `package.json`

### Fixed
- Refresh-token cookie was hardcoded to `SameSite=Strict`, which browsers silently drop on cross-site requests - this broke auth entirely on split-domain deploys (frontend and API on different domains, e.g. Railway). Now derived from `TYPEFLOW_COOKIE_SECURE`: `None` in production, `Lax` for local HTTP dev
- Backend now respects `$PORT` at runtime instead of a hardcoded 8000, for platforms (Railway, Render) that assign the listen port dynamically
- `dailyStats` test used a hardcoded date that aged out of the 365-day window; now relative to "now"

---

## [0.1.0] - 2026-07-02

### Added
- Typing test engine with time, word-count, quote, and practice modes
- Per-key accuracy heatmap, WPM history charts, and activity heatmap
- Profile page with aggregated stats (`GET /runs/profile-stats`)
- JWT authentication with refresh-token rotation and password reset
- Guest mode - type and see results with no account; sign-in is optional and prompted after a run, not before
- Run sync across devices, with local history that syncs automatically on sign-in
- Global and monthly leaderboards
- Keyboard tracking (name + layout per keyboard)
- Ghost pacing against a personal-best replay
- FastAPI backend with async SQLAlchemy, Alembic migrations, and SQLite/PostgreSQL support
- Rate limiting on auth endpoints
- `TYPEFLOW_REGISTRATION_OPEN` config flag - set to `false` to close public signups while keeping existing accounts active
- Actionable network/CORS error messages in the frontend (account menu and login/register form) instead of a silent failed fetch
- Content pipeline prepared for future languages: word/quote packs are registered by language code, `TestConfig`/`RunRecord` carry a `language` field, and the leaderboard only qualifies English runs until other languages get their own boards
- One-command self-hosted deploy: `deploy.sh` / `deploy.ps1`, with `--pull` to deploy prebuilt images instead of building locally
- Release pipeline (`.github/workflows/release.yml`) - tagging `v*` builds and publishes multi-arch (amd64 + arm64) Docker images to GHCR (`typeflow-api`, `typeflow-web`) and cuts a GitHub Release
- MIT license

### Changed
- Project restructured into `frontend/`, `backend/`, and `docker/` top-level directories
- All configuration consolidated into a single `.env` at the project root (previously split across `backend/.env` and `backend/.env.docker`)
- `deploy.sh` / `deploy.ps1` check port availability before starting, with clear errors instead of an opaque Docker failure
- Frontend Docker image bakes a `__TYPEFLOW_API_URL__` sentinel that's substituted at container start, so one prebuilt image works on any domain
- pnpm pinned to `10.28.1` via `packageManager` to keep local and Docker builds consistent

### Fixed
- Docker build failures from pnpm's build-script allowlist (esbuild, sharp, unrs-resolver)
