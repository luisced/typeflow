#!/bin/sh
# Runtime substitution of the API URL in a prebuilt image.
#
# Release images are built with the sentinel __TYPEFLOW_API_URL__ baked into
# the Next.js bundles (NEXT_PUBLIC_* vars are inlined at build time). At
# container start we replace it with $TYPEFLOW_API_URL so one image works on
# any domain. Substitution is one-shot: recreate the container (not just
# restart it) to change the URL.
set -e

: "${TYPEFLOW_API_URL:=http://localhost:8000}"

SENTINEL="__TYPEFLOW_API_URL__"

if grep -rls "$SENTINEL" /app/.next /app/server.js 2>/dev/null | head -1 >/dev/null; then
  grep -rls "$SENTINEL" /app/.next /app/server.js 2>/dev/null | while read -r f; do
    sed -i "s|$SENTINEL|$TYPEFLOW_API_URL|g" "$f"
  done
  echo "typeflow-web: API URL set to $TYPEFLOW_API_URL"
fi

exec node server.js
