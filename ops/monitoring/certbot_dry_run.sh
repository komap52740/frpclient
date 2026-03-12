#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init certbot_dry_run
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip certbot dry-run: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

certbot renew --dry-run
job_status_mark_success "certbot dry-run passed"
