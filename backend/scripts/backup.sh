#!/usr/bin/env bash
# Nightly Postgres backup — run from the VPS via cron.
# Example crontab (2 AM daily):
#   0 2 * * * /opt/typeflow/backend/scripts/backup.sh >> /var/log/typeflow-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/typeflow}"
CONTAINER="${POSTGRES_CONTAINER:-typeflow-postgres-1}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/typeflow_${STAMP}.sql.gz"

docker exec "$CONTAINER" pg_dump -U typeflow typeflow | gzip > "$OUT"
find "$BACKUP_DIR" -name 'typeflow_*.sql.gz' -mtime +"$RETAIN_DAYS" -delete

echo "Backup written to $OUT"
