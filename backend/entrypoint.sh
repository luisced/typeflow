#!/bin/sh
set -e
# Use the project venv directly — uv run needs a writable $HOME for its cache,
# but the typeflow system user defaults to /nonexistent.
.venv/bin/alembic upgrade head

# Platforms like Railway/Render assign the listen port via $PORT at runtime;
# self-hosted Docker Compose has no PORT set, so this keeps the 8000 default.
PORT="${PORT:-8000}"

if [ "${TYPEFLOW_RELOAD:-}" = "true" ] || [ "${TYPEFLOW_RELOAD:-}" = "1" ]; then
  exec .venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --reload \
    --reload-dir /app/app \
    --no-access-log
fi

exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1 --no-access-log
