#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BASE_URL=${BASE_URL:-https://frpclient.ru}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-ClientFRP_bot}
OAUTH_PROVIDERS=${OAUTH_PROVIDERS:-google vk yandex}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init public_smoke
    trap 'job_status_finalize "$?"' EXIT
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip public smoke: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

cd "$PROJECT_DIR"

if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
else
    echo "python3 or python is required" >&2
    exit 1
fi

set -- "$PYTHON_BIN" scripts/prod_smoke.py --base-url "$BASE_URL"
for provider in $OAUTH_PROVIDERS; do
    set -- "$@" --oauth-provider "$provider"
done
if [ -n "$TELEGRAM_BOT_USERNAME" ]; then
    set -- "$@" --telegram-bot-username "$TELEGRAM_BOT_USERNAME"
fi

"$@"
job_status_mark_success "public smoke passed for $BASE_URL"
