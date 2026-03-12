#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
COMPOSE_FILE=${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}
BACKEND_SERVICE=${BACKEND_SERVICE:-backend}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init django_housekeeping
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip django housekeeping: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

if docker compose version >/dev/null 2>&1; then
    compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
    compose() { docker-compose "$@"; }
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

run_manage() {
    echo "==> python manage.py $*"
    compose -f "$COMPOSE_FILE" run --rm --no-deps "$BACKEND_SERVICE" python manage.py "$@"
}

run_manage clearsessions
run_manage flushexpiredtokens

echo "django housekeeping passed"
job_status_mark_success "django housekeeping passed"
