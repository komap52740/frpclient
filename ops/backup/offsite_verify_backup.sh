#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/postgres}
MEDIA_BACKUP_DIR=${MEDIA_BACKUP_DIR:-/var/backups/frpclient/media}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}
OFFSITE_BACKUP_HELPER=${OFFSITE_BACKUP_HELPER:-$PROJECT_DIR/ops/backup/offsite_backup.py}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init offsite_backup_verify
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip offsite backup verify: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

[ -f "$OFFSITE_BACKUP_HELPER" ] || {
    echo "offsite backup helper not found: $OFFSITE_BACKUP_HELPER" >&2
    exit 1
}

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
    secret_env_export_backend_vars python3 "$PROJECT_DIR"
fi

if [ "${OFFSITE_BACKUP_ENABLED:-0}" != "1" ]; then
    echo "skip offsite backup verify: OFFSITE_BACKUP_ENABLED is not enabled"
    job_status_mark_skipped "OFFSITE_BACKUP_ENABLED is not enabled"
    exit 0
fi

POSTGRES_LATEST=${POSTGRES_LATEST:-$BACKUP_DIR/latest.sql.gz}
MEDIA_LATEST=${MEDIA_LATEST:-$MEDIA_BACKUP_DIR/latest.tar.gz}

[ -e "$POSTGRES_LATEST" ] || { echo "postgres latest backup missing: $POSTGRES_LATEST" >&2; exit 1; }
[ -e "$MEDIA_LATEST" ] || { echo "media latest backup missing: $MEDIA_LATEST" >&2; exit 1; }

python3 "$OFFSITE_BACKUP_HELPER" verify --artifact-type postgres --local-path "$(readlink -f "$POSTGRES_LATEST")"
python3 "$OFFSITE_BACKUP_HELPER" verify --artifact-type media --local-path "$(readlink -f "$MEDIA_LATEST")"

job_status_mark_success "postgres+media offsite verify passed"
echo "offsite backup verify passed"
