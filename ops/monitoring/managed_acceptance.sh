#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BASE_URL=${BASE_URL:-https://frpclient.ru}
USERNAME_PREFIX=${USERNAME_PREFIX:-smoke_client}
KEEP_ARTIFACTS=${KEEP_ARTIFACTS:-0}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init managed_acceptance
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip managed acceptance: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

cd "$PROJECT_DIR"

if docker compose version >/dev/null 2>&1; then
    compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
    compose() { docker-compose "$@"; }
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

set -- python manage.py run_prod_acceptance --base-url "$BASE_URL" --username-prefix "$USERNAME_PREFIX"
if [ "$KEEP_ARTIFACTS" = "1" ]; then
    set -- "$@" --keep-artifacts
fi

compose -f docker-compose.prod.yml exec -T backend "$@"
job_status_mark_success "managed acceptance passed"
