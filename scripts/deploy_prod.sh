#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_DIR"

WITH_BOT=0
RUN_PREFLIGHT=1
RUN_SMOKE=0
RUN_ACCEPTANCE=0
RUN_IMAGE_SNAPSHOT=1
RUN_BACKUP=0
RUN_RUNTIME_AUDIT=0
RUN_DOCKER_PRUNE=1
RUN_MAINTENANCE_MODE=1
SNAPSHOT_LABEL=none
BASE_URL=${BASE_URL:-https://frpclient.ru}
LOCAL_HEALTH_URL=${LOCAL_HEALTH_URL:-http://127.0.0.1:8080/healthz}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-}
SMOKE_OAUTH_PROVIDERS=${SMOKE_OAUTH_PROVIDERS:-google vk yandex}
MAINTENANCE_SCRIPT=${MAINTENANCE_SCRIPT:-ops/nginx/maintenance_mode.sh}
MAINTENANCE_ACTIVE=0
PAUSED_TIMERS=""
LOCK_SCRIPT=${LOCK_SCRIPT:-ops/common/deploy_lock.sh}
LOCK_ACTIVE=0
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-ops/common/job_status.sh}
RELEASE_STATE_HELPER=${RELEASE_STATE_HELPER:-ops/common/release_state.sh}
RELEASE_STATE_ENABLED=0
RELEASE_GUARD_HELPER=${RELEASE_GUARD_HELPER:-ops/common/git_release_guard.sh}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-ops/common/secret_env.sh}
SOURCE_METADATA_SCRIPT=${SOURCE_METADATA_SCRIPT:-$REPO_DIR/ops/common/source_metadata.py}
SOURCE_GIT_COMMIT=
SOURCE_GIT_BRANCH=
SOURCE_GIT_TAG=
SOURCE_FINGERPRINT=
SOURCE_FINGERPRINT_SHORT=
SOURCE_GIT_CLEAN=0
POSTGRES_CONTAINER_NAME=${POSTGRES_CONTAINER_NAME:-frp-postgres}
REDIS_CONTAINER_NAME=${REDIS_CONTAINER_NAME:-frp-redis}
BACKEND_CONTAINER_NAME=${BACKEND_CONTAINER_NAME:-frp-backend}
BACKEND_WS_CONTAINER_NAME=${BACKEND_WS_CONTAINER_NAME:-frp-backend-ws}
FRONTEND_CONTAINER_NAME=${FRONTEND_CONTAINER_NAME:-frp-frontend}
TELEGRAM_BOT_CONTAINER_NAME=${TELEGRAM_BOT_CONTAINER_NAME:-frp-telegram-bot}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init deploy
fi

if [ -f "$RELEASE_STATE_HELPER" ]; then
    . "$RELEASE_STATE_HELPER"
    RELEASE_STATE_ENABLED=1
fi

if [ -f "$RELEASE_GUARD_HELPER" ]; then
    . "$RELEASE_GUARD_HELPER"
fi

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
fi

print_usage() {
    cat <<'EOF'
Usage: sh scripts/deploy_prod.sh [options]

Options:
  --with-bot                     Start telegram-bot via docker-compose.prod.bot.yml
  --skip-image-snapshot         Skip rollback image snapshot before deploy
  --skip-preflight              Skip scripts/prod_preflight.py before deploy
  --backup-first                 Create Postgres and media backups before deploy
  --smoke                        Run public smoke checks after deploy
  --acceptance                   Run managed end-to-end production acceptance after smoke
  --runtime-audit                Run ops/monitoring/runtime_audit.sh after deploy
  --skip-maintenance-mode        Do not enable system nginx maintenance marker during deploy
  --skip-docker-prune            Skip pruning dangling docker images after successful deploy
  --base-url URL                 Public base URL for smoke checks
  --telegram-bot-username NAME   Expected bot username for frontend smoke check
  --help                         Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --with-bot)
            WITH_BOT=1
            ;;
        --skip-image-snapshot)
            RUN_IMAGE_SNAPSHOT=0
            ;;
        --skip-preflight)
            RUN_PREFLIGHT=0
            ;;
        --backup-first)
            RUN_BACKUP=1
            ;;
        --smoke)
            RUN_SMOKE=1
            ;;
        --acceptance)
            RUN_ACCEPTANCE=1
            ;;
        --runtime-audit)
            RUN_RUNTIME_AUDIT=1
            ;;
        --skip-maintenance-mode)
            RUN_MAINTENANCE_MODE=0
            ;;
        --skip-docker-prune)
            RUN_DOCKER_PRUNE=0
            ;;
        --base-url)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --base-url" >&2; exit 1; }
            BASE_URL=$1
            ;;
        --telegram-bot-username)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --telegram-bot-username" >&2; exit 1; }
            TELEGRAM_BOT_USERNAME=$1
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        *)
            echo "unknown option: $1" >&2
            print_usage >&2
            exit 1
            ;;
    esac
    shift
done

if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN=docker
    COMPOSE_SUBCOMMAND=compose
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN=docker-compose
    COMPOSE_SUBCOMMAND=
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

compose() {
    if [ -n "$COMPOSE_SUBCOMMAND" ]; then
        "$COMPOSE_BIN" "$COMPOSE_SUBCOMMAND" "$@"
    else
        "$COMPOSE_BIN" "$@"
    fi
}

compose_prod() {
    if [ "$WITH_BOT" -eq 1 ]; then
        compose -f docker-compose.prod.yml -f docker-compose.prod.bot.yml "$@"
    else
        compose -f docker-compose.prod.yml "$@"
    fi
}

compose_ps() {
    compose_prod ps
}

show_failure_diagnostics() {
    set +e

    echo "==> Deploy diagnostics"
    compose_ps || true

    echo "==> Recent backend logs"
    compose_prod logs --tail 80 backend backend-ws frontend || true

    if [ "$WITH_BOT" -eq 1 ]; then
        echo "==> Recent telegram-bot logs"
        compose_prod logs --tail 80 telegram-bot || true
    fi
}

on_exit() {
    exit_code=$1
    if [ "$exit_code" -eq 0 ] && [ "$MAINTENANCE_ACTIVE" -eq 1 ]; then
        disable_maintenance_mode
    fi
    resume_paused_timers
    release_deploy_lock
    if [ "$exit_code" -ne 0 ]; then
        show_failure_diagnostics
        if [ "$MAINTENANCE_ACTIVE" -eq 1 ]; then
            echo "==> Maintenance mode remains enabled after failed deploy"
        fi
        job_status_mark_failure "deploy failed"
    fi
    job_status_finalize "$exit_code"
}

trap 'exit_code=$?; on_exit "$exit_code"; exit "$exit_code"' EXIT

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

maintenance_script_available() {
    [ "$RUN_MAINTENANCE_MODE" -eq 1 ] && [ -f "$MAINTENANCE_SCRIPT" ]
}

acquire_deploy_lock() {
    if [ "$LOCK_ACTIVE" -eq 0 ] && [ -f "$LOCK_SCRIPT" ]; then
        echo "==> Acquire deploy lock"
        sh "$LOCK_SCRIPT" acquire deploy
        LOCK_ACTIVE=1
    fi
}

release_deploy_lock() {
    if [ "$LOCK_ACTIVE" -eq 1 ] && [ -f "$LOCK_SCRIPT" ]; then
        echo "==> Release deploy lock"
        sh "$LOCK_SCRIPT" release
        LOCK_ACTIVE=0
    fi
}

pause_timer_if_active() {
    timer_name=$1

    if ! command -v systemctl >/dev/null 2>&1; then
        return 0
    fi
    if ! systemctl cat "$timer_name" >/dev/null 2>&1; then
        return 0
    fi
    if systemctl is-active --quiet "$timer_name"; then
        echo "==> Pause timer: $timer_name"
        systemctl stop "$timer_name"
        PAUSED_TIMERS="$PAUSED_TIMERS $timer_name"
    fi
}

pause_maintenance_timers() {
    pause_timer_if_active frpclient-public-smoke.timer
    pause_timer_if_active frpclient-managed-acceptance.timer
    pause_timer_if_active frpclient-runtime-audit.timer
}

resume_paused_timers() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 0
    fi

    for timer_name in $PAUSED_TIMERS; do
        echo "==> Resume timer: $timer_name"
        systemctl start "$timer_name"
    done
    PAUSED_TIMERS=""
}

refresh_public_smoke_service() {
    if command -v systemctl >/dev/null 2>&1 && systemctl cat frpclient-public-smoke.service >/dev/null 2>&1; then
        echo "==> Refresh public smoke service"
        systemctl start frpclient-public-smoke.service
    fi
}

enable_maintenance_mode() {
    if maintenance_script_available && [ "$MAINTENANCE_ACTIVE" -eq 0 ]; then
        pause_maintenance_timers
        echo "==> Enable maintenance mode"
        sh "$MAINTENANCE_SCRIPT" on deploy
        MAINTENANCE_ACTIVE=1
    fi
}

disable_maintenance_mode() {
    if maintenance_script_available && [ "$MAINTENANCE_ACTIVE" -eq 1 ]; then
        echo "==> Disable maintenance mode"
        sh "$MAINTENANCE_SCRIPT" off
        MAINTENANCE_ACTIVE=0
    fi
}

wait_for_local_health() {
    python_bin=$1
    health_url=$2
    base_url=$3
    max_attempts=${4:-60}
    attempt=1

    echo "==> Wait for local health"
    while [ "$attempt" -le "$max_attempts" ]; do
        if "$python_bin" - "$health_url" "$base_url" <<'PY'
import sys
import urllib.request
from urllib.parse import urlparse

url = sys.argv[1]
host = urlparse(sys.argv[2]).netloc

try:
    request = urllib.request.Request(url, headers={"Host": host})
    with urllib.request.urlopen(request, timeout=10) as response:
        raise SystemExit(0 if response.status == 200 else 1)
except Exception:
    raise SystemExit(1)
PY
        then
            return 0
        fi

        sleep 2
        attempt=$((attempt + 1))
    done

    echo "local health endpoint did not become ready in time" >&2
    return 1
}

run_public_smoke() {
    python_bin=$1

    wait_for_local_health "$python_bin" "$LOCAL_HEALTH_URL" "$BASE_URL"

    echo "==> Public smoke test"
    OAUTH_PROVIDERS="$SMOKE_OAUTH_PROVIDERS" \
    BASE_URL="$BASE_URL" \
    TELEGRAM_BOT_USERNAME="$TELEGRAM_BOT_USERNAME" \
    IGNORE_DEPLOY_LOCK=1 \
        sh ops/monitoring/public_smoke.sh
}

run_preflight() {
    python_bin=$1

    echo "==> Production preflight"
    "$python_bin" scripts/prod_preflight.py --base-url "$BASE_URL"
}

run_image_snapshot() {
    if [ "$WITH_BOT" -eq 1 ]; then
        sh scripts/prod_image_snapshot.sh --with-bot
    else
        sh scripts/prod_image_snapshot.sh
    fi
}

build_application_images() {
    echo "==> Build application images"
    if [ "$WITH_BOT" -eq 1 ]; then
        compose_prod build backend backend-ws frontend telegram-bot
    else
        compose_prod build backend backend-ws frontend
    fi
}

start_infra_services() {
    echo "==> Ensure infra services"
    compose_prod up -d postgres redis
}

wait_for_infra_health() {
    echo "==> Wait for infra health"
    CONTAINERS="$POSTGRES_CONTAINER_NAME $REDIS_CONTAINER_NAME" sh scripts/wait_prod_containers.sh
}

run_backend_maintenance() {
    echo "==> Apply database migrations"
    compose_prod run --rm --no-deps backend python manage.py migrate

    echo "==> Collect static files"
    compose_prod run --rm --no-deps backend python manage.py collectstatic --noinput
}

run_runtime_audit() {
    echo "==> Runtime audit"
    runtime_env=""
    if command -v systemctl >/dev/null 2>&1; then
        systemctl cat frpclient-postgres-verify.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_BACKUP_VERIFY_TIMER=1"
        systemctl cat frpclient-media-backup.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_MEDIA_BACKUP_TIMER=1"
        systemctl cat frpclient-media-verify.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_MEDIA_VERIFY_TIMER=1"
        systemctl cat frpclient-offsite-backup-verify.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_OFFSITE_BACKUP_VERIFY_TIMER=1"
        systemctl cat frpclient-django-housekeeping.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_DJANGO_HOUSEKEEPING_TIMER=1"
        systemctl cat frpclient-platform-metrics.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_PLATFORM_METRICS_TIMER=1"
        systemctl cat frpclient-managed-acceptance.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_MANAGED_ACCEPTANCE_TIMER=1"
        systemctl cat certbot.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_CERTBOT_TIMER=1"
        systemctl cat frpclient-certbot-dry-run.timer >/dev/null 2>&1 && runtime_env="$runtime_env REQUIRE_CERTBOT_DRY_RUN_TIMER=1"
    fi

    if [ -n "$runtime_env" ]; then
        # shellcheck disable=SC2086
        env IGNORE_DEPLOY_LOCK=1 $runtime_env sh ops/monitoring/runtime_audit.sh
    else
        IGNORE_DEPLOY_LOCK=1 sh ops/monitoring/runtime_audit.sh
    fi
}

run_managed_acceptance() {
    echo "==> Managed production acceptance"
    BASE_URL="$BASE_URL" \
    IGNORE_DEPLOY_LOCK=1 \
        sh ops/monitoring/managed_acceptance.sh
}

write_release_state() {
    if [ "$RELEASE_STATE_ENABLED" -ne 1 ]; then
        return 0
    fi

    echo "==> Write release state"
    RELEASE_STATE_BASE_URL=$BASE_URL
    RELEASE_STATE_WITH_BOT=$WITH_BOT
    RELEASE_STATE_STARTED_AT=${JOB_STATUS_STARTED_AT:-}
    RELEASE_STATE_ROLLBACK_SNAPSHOT_LABEL=$SNAPSHOT_LABEL
    RELEASE_STATE_SOURCE_AUTHORITATIVE=1
    RELEASE_STATE_SOURCE_GIT_COMMIT=$SOURCE_GIT_COMMIT
    RELEASE_STATE_SOURCE_GIT_BRANCH=$SOURCE_GIT_BRANCH
    RELEASE_STATE_SOURCE_GIT_TAG=$SOURCE_GIT_TAG
    RELEASE_STATE_SOURCE_FINGERPRINT=$SOURCE_FINGERPRINT
    release_state_write deploy
}

PYTHON_BIN=$(resolve_python_bin)
secret_env_resolve_paths "$PYTHON_BIN" "$REPO_DIR"
secret_env_assert_files_exist
secret_env_export_frontend_build_vars "$PYTHON_BIN" "$REPO_DIR"
release_guard_resolve_metadata "$PYTHON_BIN" "$REPO_DIR" "$SOURCE_METADATA_SCRIPT"

acquire_deploy_lock

if [ "$RUN_PREFLIGHT" -eq 1 ]; then
    run_preflight "$PYTHON_BIN"
fi

if [ "$RUN_IMAGE_SNAPSHOT" -eq 1 ]; then
    echo "==> Snapshot current images for rollback"
    SNAPSHOT_LABEL=$(run_image_snapshot)
fi

if [ "$RUN_BACKUP" -eq 1 ]; then
    echo "==> Pre-deploy backup"
    IGNORE_DEPLOY_LOCK=1 sh ops/backup/postgres_backup.sh
    IGNORE_DEPLOY_LOCK=1 sh ops/backup/media_backup.sh
fi

start_infra_services
wait_for_infra_health
build_application_images
enable_maintenance_mode
run_backend_maintenance

echo "==> Start application stack"
if [ "$WITH_BOT" -eq 1 ]; then
    echo "==> Start application stack + telegram bot"
    compose_prod up -d
else
    compose_prod up -d
fi

echo "==> Compose status"
compose_ps

echo "==> Wait for core container health"
CONTAINERS="$BACKEND_CONTAINER_NAME $BACKEND_WS_CONTAINER_NAME $FRONTEND_CONTAINER_NAME" sh scripts/wait_prod_containers.sh

wait_for_local_health "$PYTHON_BIN" "$LOCAL_HEALTH_URL" "$BASE_URL"
disable_maintenance_mode
resume_paused_timers
write_release_state
refresh_public_smoke_service

if [ "$RUN_SMOKE" -eq 1 ]; then
    run_public_smoke "$PYTHON_BIN"
fi

if [ "$RUN_ACCEPTANCE" -eq 1 ]; then
    run_managed_acceptance
fi

if [ "$RUN_RUNTIME_AUDIT" -eq 1 ]; then
    run_runtime_audit
fi

if [ "$RUN_DOCKER_PRUNE" -eq 1 ]; then
    sh scripts/prune_docker_artifacts.sh
fi

if [ "$SNAPSHOT_LABEL" != "none" ]; then
    echo "==> Rollback snapshot available: $SNAPSHOT_LABEL"
    echo "==> Rollback command: sh scripts/rollback_prod.sh --label $SNAPSHOT_LABEL --smoke --runtime-audit"
fi

job_status_mark_success "deploy completed rollback_snapshot=$SNAPSHOT_LABEL"
