#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/media}
VERIFY_ROOT=${VERIFY_ROOT:-/tmp/frpclient_media_verify}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init media_verify
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip media backup verify: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    job_status_finalize 0
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

usage() {
    cat <<'EOF'
Usage: sh ops/backup/media_verify_backup.sh [path/to/media-backup.tar.gz]

If no path is provided, the script verifies /var/backups/frpclient/media/latest.tar.gz.
The archive is extracted into a temporary directory and then removed.
EOF
}

if [ "$#" -gt 1 ]; then
    usage >&2
    exit 1
fi

if [ "$#" -eq 1 ]; then
    ARCHIVE_PATH=$1
else
    ARCHIVE_PATH=$BACKUP_DIR/latest.tar.gz
fi

[ -f "$ARCHIVE_PATH" ] || { echo "archive not found: $ARCHIVE_PATH" >&2; exit 1; }

mkdir -p "$VERIFY_ROOT"
VERIFY_DIR="$VERIFY_ROOT/verify-$(date -u +%Y%m%d%H%M%S)-$$"

cleanup() {
    rm -rf "$VERIFY_DIR"
}

finish() {
    exit_code=$1
    cleanup
    if [ "$exit_code" -eq 0 ]; then
        job_status_finalize 0
    else
        job_status_mark_failure "media verify failed"
        job_status_finalize "$exit_code"
    fi
}

trap 'exit_code=$?; finish "$exit_code"; exit "$exit_code"' EXIT INT TERM

tar -tzf "$ARCHIVE_PATH" >/dev/null
mkdir -p "$VERIFY_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$VERIFY_DIR"

[ -d "$VERIFY_DIR/app/media" ] || { echo "media directory missing after extract: $ARCHIVE_PATH" >&2; exit 1; }

entry_count=$(find "$VERIFY_DIR/app/media" | wc -l | awk '{print $1}')
[ "$entry_count" -ge 1 ] || { echo "media verify extracted no entries: $ARCHIVE_PATH" >&2; exit 1; }

job_status_mark_success "archive=$ARCHIVE_PATH entry_count=$entry_count"
printf '%s\n' "media backup verify passed: archive=$ARCHIVE_PATH entry_count=$entry_count"
