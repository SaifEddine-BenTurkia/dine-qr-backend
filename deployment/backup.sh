#!/usr/bin/env bash
#
# Nightly database dump, kept 14 days. Install once on the VPS:
#
#   ( crontab -l 2>/dev/null; echo '30 2 * * * /opt/tableqr/backup.sh >> /opt/tableqr/backups/cron.log 2>&1' ) | crontab -
#
# These dumps sit on the same disk as the database. Copy them off the server
# (rclone to object storage, or the VPS provider's snapshots) to survive losing
# the machine.
#
set -Eeuo pipefail

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${deploy_dir}"
mkdir -p backups

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="backups/nightly-${timestamp}.dump"

docker compose --env-file .env.production -f compose.production.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "${target}.partial"
mv "${target}.partial" "${target}"

find backups -name 'nightly-*.dump' -mtime +14 -delete
echo "$(date -u +%FT%TZ) wrote ${target} ($(du -h "${target}" | cut -f1))"
