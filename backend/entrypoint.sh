#!/bin/sh
set -e
# Use the project venv directly — uv run needs a writable $HOME for its cache,
# but the typeflow system user defaults to /nonexistent.
.venv/bin/alembic upgrade head

if [ "${TYPEFLOW_RELOAD:-}" = "true" ] || [ "${TYPEFLOW_RELOAD:-}" = "1" ]; then
  exec .venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app/app \
    --no-access-log
fi

exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-access-log
