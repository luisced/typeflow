# TypeFlow

A self-hosted typing speed trainer with sync across devices, leaderboards, and detailed per-key stats.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

---

## Self-hosting

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2.20+)
- Git

### Deploy

```bash
git clone https://github.com/luisced/typeflow
cd typeflow
```

**Linux / macOS**
```bash
./deploy.sh --pull    # prebuilt images from GHCR (recommended)
./deploy.sh           # or build locally from this checkout
```

**Windows (PowerShell)**
```powershell
.\deploy.ps1 -Pull    # prebuilt images from GHCR (recommended)
.\deploy.ps1          # or build locally from this checkout
```

The first run copies `.env.example` → `.env` and exits so you can fill in the required values. Edit the file and run the script again.

Prebuilt images are multi-arch (`amd64` + `arm64`, so Raspberry Pi works) and published on every release: [`typeflow-api`](https://github.com/luisced/typeflow/pkgs/container/typeflow-api) and [`typeflow-web`](https://github.com/luisced/typeflow/pkgs/container/typeflow-web). Pin a version with `TYPEFLOW_VERSION=x.y.z` in `.env`.

```
TypeFlow is up.
  Frontend → http://localhost:3000
  API      → http://localhost:8000
```

### Configuration

All settings live in a single `.env` file at the project root. Required fields:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Database password |
| `TYPEFLOW_JWT_SECRET` | Random string ≥ 32 chars - generate with `openssl rand -hex 32` |
| `TYPEFLOW_CORS_ORIGINS` | JSON array of allowed frontend origins |

Optional fields (commented out in `.env.example` - uncomment to override the default):

| Variable | Default | Description |
|---|---|---|
| `API_PORT` | `8000` | Host port for the API |
| `WEB_PORT` | `3000` | Host port for the frontend |
| `NEXT_PUBLIC_TYPEFLOW_API_URL` | `http://localhost:8000` | Public URL of the API as seen from the browser |
| `TYPEFLOW_REGISTRATION_OPEN` | `true` | Set to `false` to close signups after your accounts are created |
| `TYPEFLOW_COOKIE_SECURE` | `true` | Set to `false` only for local HTTP (no TLS) |
| `TYPEFLOW_ENV` | `production` | Use `development` to allow weak JWT secrets |

### Deploying on a domain

1. Set `NEXT_PUBLIC_TYPEFLOW_API_URL=https://api.yourdomain.com` in `.env`
2. Set `TYPEFLOW_CORS_ORIGINS=["https://yourdomain.com"]`
3. Set `TYPEFLOW_COOKIE_SECURE=true`
4. Put a reverse proxy (Caddy, Nginx, Traefik) in front - the frontend runs on `WEB_PORT` and the API on `API_PORT`
5. Run `./deploy.sh` (or `.\deploy.ps1`)

### Updating

```bash
./deploy.sh --pull        # picks up the newest release images
```

Or when building locally:

```bash
git pull
./deploy.sh
```

The API container runs database migrations automatically on startup (`alembic upgrade head`), so no manual migration step is needed.

### Stopping

```bash
docker compose -f docker/docker-compose.yml --env-file .env down
```

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)
