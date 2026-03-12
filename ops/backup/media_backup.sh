#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/media}
RETENTION_DAYS=${RETENTION_DAYS:-14}
KEEP_COUNT=${KEEP_COUNT:-10}
SOURCE_CONTAINER=${SOURCE_CONTAINER:-frp-backend}
SOURCE_PATH=${SOURCE_PATH:-/app/media}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}
PRUNE_SCRIPT=${PRUNE_SCRIPT:-$PROJECT_DIR/ops/backup/prune_backup_artifacts.py}
OFFSITE_BACKUP_HELPER=${OFFSITE_BACKUP_HELPER:-$PROJECT_DIR/ops/backup/offsite_backup.py}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}
MEDIA_STORAGE_SYNC_HELPER=${MEDIA_STORAGE_SYNC_HELPER:-$PROJECT_DIR/ops/backup/media_object_storage.py}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init media_backup
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip media backup: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

mkdir -p "$BACKUP_DIR"

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
    secret_env_export_backend_vars python3 "$PROJECT_DIR"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_path="$BACKUP_DIR/frpclient-media-$timestamp.tar.gz"
tmp_path="$backup_path.tmp"
latest_link="$BACKUP_DIR/latest.tar.gz"

media_mode=$(python3 "$MEDIA_STORAGE_SYNC_HELPER" mode)
if [ "$media_mode" = "r2" ] || [ "$media_mode" = "s3" ]; then
    export_root="$BACKUP_DIR/.media-export-$timestamp-$$"
    rm -rf "$export_root"
    python3 "$MEDIA_STORAGE_SYNC_HELPER" export --destination "$export_root"
    tar -C "$export_root" -czf "$tmp_path" app/media
    rm -rf "$export_root"
else
    docker inspect "$SOURCE_CONTAINER" >/dev/null 2>&1 || {
        echo "source container not found: $SOURCE_CONTAINER" >&2
        exit 1
    }

    docker exec "$SOURCE_CONTAINER" sh -c "test -d '$SOURCE_PATH'" || {
        echo "source path not found in container: $SOURCE_PATH" >&2
        exit 1
    }

    docker exec "$SOURCE_CONTAINER" sh -c "tar -C / -czf - app/media" > "$tmp_path"
fi
tar -tzf "$tmp_path" >/dev/null

mv "$tmp_path" "$backup_path"
ln -sfn "$backup_path" "$latest_link"

python3 "$PRUNE_SCRIPT" "$BACKUP_DIR" \
    --pattern 'frpclient-media-*.tar.gz' \
    --latest-link "$latest_link" \
    --keep-count "$KEEP_COUNT" \
    --retention-days "$RETENTION_DAYS"

summary=$backup_path
if [ "${OFFSITE_BACKUP_ENABLED:-0}" = "1" ]; then
    python3 "$OFFSITE_BACKUP_HELPER" upload \
        --artifact-type media \
        --local-path "$backup_path" \
        --keep-count "$KEEP_COUNT" \
        --retention-days "$RETENTION_DAYS"
    summary="$backup_path (offsite uploaded)"
fi

job_status_mark_success "$summary"
echo "$backup_path"
