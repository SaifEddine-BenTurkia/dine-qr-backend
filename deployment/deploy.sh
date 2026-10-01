#!/usr/bin/env bash
#
# Deploys the given images on the VPS. Run by GitHub Actions over SSH:
#
#   API_IMAGE=ghcr.io/...:sha MIGRATION_IMAGE=ghcr.io/...-migrate:sha ./deploy.sh
#
# Steps: pull -> start Postgres -> back up the database -> run migrations ->
# swap the API container -> wait for /health/ready. If the new API never
# becomes ready, the previous image is started again and the script fails, so
# the workflow run goes red.
#
# Migrations are not rolled back automatically. Keep them backwards compatible
# (add columns first, remove them in a later release) so the previous API image
# keeps working on the migrated schema; the pre-deploy dump is the last resort.
#
set -Eeuo pipefail

: "${API_IMAGE:?API_IMAGE is required}"
: "${MIGRATION_IMAGE:?MIGRATION_IMAGE is required}"
export API_IMAGE MIGRATION_IMAGE

deploy_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${deploy_dir}"

env_file=".env.production"
state_file=".deployed-images"
backup_dir="backups"
health_url="http://127.0.0.1:3100/health/ready"

# Registry credentials for this project live here, not in ~/.docker, so they
# never overwrite the login ArisHub's deployment uses on the same account.
export DOCKER_CONFIG="${deploy_dir}/.docker"

compose() {
  docker compose --env-file "${env_file}" -f compose.production.yml "$@"
}

log() { printf '\n==> %s\n' "$*"; }

test -f "${env_file}" || { echo "Missing ${deploy_dir}/${env_file}" >&2; exit 1; }
mkdir -p "${backup_dir}"

previous_api=""
if [[ -f "${state_file}" ]]; then
  previous_api="$(sed -n 's/^API_IMAGE=//p' "${state_file}")"
fi

log "Pulling ${API_IMAGE}"
compose pull --quiet api migrate

log "Starting Postgres"
compose up -d --wait postgres

log "Backing up the database"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "${backup_dir}/pre-deploy-${timestamp}.dump"

log "Applying migrations"
compose run --rm migrate

log "Starting the new API"
compose up -d --no-deps --force-recreate api

ready=false
for _ in $(seq 1 45); do
  if curl --fail --silent --max-time 3 "${health_url}" >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done

if [[ "${ready}" != true ]]; then
  echo "New API did not become ready. Recent logs:" >&2
  compose logs --tail=200 api >&2 || true
  if [[ -n "${previous_api}" ]]; then
    log "Rolling back to ${previous_api}"
    API_IMAGE="${previous_api}" compose up -d --no-deps --force-recreate api
  fi
  exit 1
fi

printf 'API_IMAGE=%s\nMIGRATION_IMAGE=%s\nDEPLOYED_AT=%s\n' \
  "${API_IMAGE}" "${MIGRATION_IMAGE}" "${timestamp}" > "${state_file}"

log "Cleaning up"
find "${backup_dir}" -name 'pre-deploy-*.dump' -mtime +14 -delete
# Only images built from this repository, and only ones no container uses.
docker image prune --all --force \
  --filter "label=org.opencontainers.image.title=dine-qr-backend" \
  --filter "until=168h" >/dev/null || true

log "Deployed ${API_IMAGE}"
