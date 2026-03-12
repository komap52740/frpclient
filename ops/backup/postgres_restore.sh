#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
ROOT_ENV_FILE=${ROOT_ENV_FILE:-$PROJECT_DIR/.env}
ENV_CHAIN_SCRIPT=${ENV_CHAIN_SCRIPT:-$PROJECT_DIR/ops/common/env_chain.py}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}

[ -f "$SECRET_ENV_HELPER" ] && . "$SECRET_ENV_HELPER"

usage() {
    cat <<'EOF'
Usage: sh ops/backup/postgres_restore.sh /path/to/backup.sql.gz --force

This script drops and recreates the target database before restore.
Use only after taking a fresh backup and confirming downtime.
EOF
}

[ "$#" -ge 2 ] || { usage >&2; exit 1; }

DUMP_PATH=$1
FORCE_FLAG=$2

[ "$FORCE_FLAG" = "--force" ] || { usage >&2; exit 1; }
[ -f "$DUMP_PATH" ] || { echo "dump not found: $DUMP_PATH" >&2; exit 1; }
secret_env_resolve_paths python3 "$PROJECT_DIR"
[ -f "$BACKEND_ENV_FILE" ] || { echo "backend env file not found: $BACKEND_ENV_FILE" >&2; exit 1; }
[ -f "$BACKEND_SECRETS_FILE" ] || { echo "backend secrets file not found: $BACKEND_SECRETS_FILE" >&2; exit 1; }

read_env_value() {
    secret_env_read_backend_value python3 "$PROJECT_DIR" "$1"
}

if docker compose version >/dev/null 2>&1; then
    compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
    compose() { docker-compose "$@"; }
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

POSTGRES_DB=$(read_env_value POSTGRES_DB)
POSTGRES_USER=$(read_env_value POSTGRES_USER)

compose -f "$PROJECT_DIR/docker-compose.prod.yml" stop frontend backend backend-ws || true
compose -f "$PROJECT_DIR/docker-compose.prod.yml" -f "$PROJECT_DIR/docker-compose.prod.bot.yml" stop telegram-bot || true

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"

gunzip -c "$DUMP_PATH" | compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1

compose -f "$PROJECT_DIR/docker-compose.prod.yml" up -d
compose -f "$PROJECT_DIR/docker-compose.prod.yml" -f "$PROJECT_DIR/docker-compose.prod.bot.yml" up -d telegram-bot
