#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
ROOT_ENV_FILE=${ROOT_ENV_FILE:-$REPO_DIR/.env.staging}
ENV_CHAIN_SCRIPT=${ENV_CHAIN_SCRIPT:-$REPO_DIR/ops/common/env_chain.py}

resolve_python_bin() {
    if command -v python3 >/dev/null 2>&1; then
        printf '%s\n' python3
    elif command -v python >/dev/null 2>&1; then
        printf '%s\n' python
    else
        echo "python3 or python is required" >&2
        exit 1
    fi
}

PYTHON_BIN=$(resolve_python_bin)

[ -f "$ROOT_ENV_FILE" ] || {
    echo "staging root env file not found: $ROOT_ENV_FILE" >&2
    exit 1
}
[ -f "$ENV_CHAIN_SCRIPT" ] || {
    echo "env chain helper not found: $ENV_CHAIN_SCRIPT" >&2
    exit 1
}

ENV_EXPORTS=$("$PYTHON_BIN" "$ENV_CHAIN_SCRIPT" --file "$ROOT_ENV_FILE" --format shell)
if [ -n "$ENV_EXPORTS" ]; then
    eval "$ENV_EXPORTS"
fi

export PROJECT_DIR=${PROJECT_DIR:-$REPO_DIR}
export ROOT_ENV_FILE
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-frpclient-staging}
export RUNTIME_STATE_DIR=${RUNTIME_STATE_DIR:-./.deploy.staging}
export POSTGRES_CONTAINER_NAME=${POSTGRES_CONTAINER_NAME:-frp-staging-postgres}
export REDIS_CONTAINER_NAME=${REDIS_CONTAINER_NAME:-frp-staging-redis}
export BACKEND_CONTAINER_NAME=${BACKEND_CONTAINER_NAME:-frp-staging-backend}
export BACKEND_WS_CONTAINER_NAME=${BACKEND_WS_CONTAINER_NAME:-frp-staging-backend-ws}
export FRONTEND_CONTAINER_NAME=${FRONTEND_CONTAINER_NAME:-frp-staging-frontend}
export TELEGRAM_BOT_CONTAINER_NAME=${TELEGRAM_BOT_CONTAINER_NAME:-frp-staging-telegram-bot}
export LOCK_DIR=${LOCK_DIR:-$REPO_DIR/.deploy.staging/active.lock}
export JOB_STATUS_DIR=${JOB_STATUS_DIR:-$REPO_DIR/.deploy.staging/status}
export RELEASE_STATE_DIR=${RELEASE_STATE_DIR:-$REPO_DIR/.deploy.staging/release}
export MARKER_PATH=${MARKER_PATH:-$REPO_DIR/.deploy.staging/maintenance-mode}
export BASE_URL=${BASE_URL:-${VITE_SITE_URL:-https://staging.frpclient.ru}}
export LOCAL_HEALTH_URL=${LOCAL_HEALTH_URL:-http://127.0.0.1:18081/healthz}

set -- --skip-image-snapshot --skip-docker-prune "$@"
exec sh "$REPO_DIR/scripts/deploy_prod.sh" "$@"
