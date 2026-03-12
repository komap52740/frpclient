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
    job_status_init platform_metrics_refresh
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip platform metrics refresh: deploy lock is active"
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

date_output=$(
    compose -f "$COMPOSE_FILE" run --rm --no-deps "$BACKEND_SERVICE" \
        python manage.py shell -c "from datetime import timedelta; from django.utils import timezone; today = timezone.localdate(); print((today - timedelta(days=1)).isoformat()); print(today.isoformat())" \
        | tail -n 2
)

set -- $date_output
[ "$#" -eq 2 ] || {
    echo "failed to resolve metrics dates: $date_output" >&2
    exit 1
}

yesterday=$1
today=$2

run_manage compute_daily_metrics --from "$yesterday" --to "$today"
run_manage shell -c "from datetime import timedelta; from django.utils import timezone; from apps.platform.models import DailyMetrics; import sys; today = timezone.localdate(); yesterday = today - timedelta(days=1); missing = [target.isoformat() for target in (yesterday, today) if not DailyMetrics.objects.filter(date=target).exists()]; print(f'missing metrics rows: {missing}', file=sys.stderr) if missing else print(f'platform metrics ok: yesterday={yesterday.isoformat()} today={today.isoformat()}'); sys.exit(1 if missing else 0)"

echo "platform metrics refresh passed"
job_status_mark_success "platform metrics refresh passed"
