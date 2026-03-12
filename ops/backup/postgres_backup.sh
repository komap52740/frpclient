#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
ROOT_ENV_FILE=${ROOT_ENV_FILE:-$PROJECT_DIR/.env}
ENV_CHAIN_SCRIPT=${ENV_CHAIN_SCRIPT:-$PROJECT_DIR/ops/common/env_chain.py}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/postgres}
RETENTION_DAYS=${RETENTION_DAYS:-14}
KEEP_COUNT=${KEEP_COUNT:-10}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}
PRUNE_SCRIPT=${PRUNE_SCRIPT:-$PROJECT_DIR/ops/backup/prune_backup_artifacts.py}
OFFSITE_BACKUP_HELPER=${OFFSITE_BACKUP_HELPER:-$PROJECT_DIR/ops/backup/offsite_backup.py}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init postgres_backup
    trap 'job_status_finalize "$?"' EXIT
fi

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip postgres backup: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

read_env_value() {
    secret_env_read_backend_value python3 "$PROJECT_DIR" "$1"
}

if docker compose version >/dev/null 2>&1; then
    compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
    compose() { docker-compose "$@"; }
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

secret_env_resolve_paths python3 "$PROJECT_DIR"
[ -f "$BACKEND_ENV_FILE" ] || { echo "backend env file not found: $BACKEND_ENV_FILE" >&2; exit 1; }
[ -f "$BACKEND_SECRETS_FILE" ] || { echo "backend secrets file not found: $BACKEND_SECRETS_FILE" >&2; exit 1; }
secret_env_export_backend_vars python3 "$PROJECT_DIR"

POSTGRES_DB=$(read_env_value POSTGRES_DB)
POSTGRES_USER=$(read_env_value POSTGRES_USER)

mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$BACKUP_DIR/frpclient-postgres-$timestamp.sql.gz"
tmp_path="$backup_path.tmp"
latest_link="$BACKUP_DIR/latest.sql.gz"

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip -9 > "$tmp_path"

mv "$tmp_path" "$backup_path"
ln -sfn "$backup_path" "$latest_link"

python3 "$PRUNE_SCRIPT" "$BACKUP_DIR" \
    --pattern 'frpclient-postgres-*.sql.gz' \
    --latest-link "$latest_link" \
    --keep-count "$KEEP_COUNT" \
    --retention-days "$RETENTION_DAYS"

summary=$backup_path
if [ "${OFFSITE_BACKUP_ENABLED:-0}" = "1" ]; then
    python3 "$OFFSITE_BACKUP_HELPER" upload \
        --artifact-type postgres \
        --local-path "$backup_path" \
        --keep-count "$KEEP_COUNT" \
        --retention-days "$RETENTION_DAYS"
    summary="$backup_path (offsite uploaded)"
fi

job_status_mark_success "$summary"
echo "$backup_path"
