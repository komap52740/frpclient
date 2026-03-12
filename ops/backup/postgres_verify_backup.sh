#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
ROOT_ENV_FILE=${ROOT_ENV_FILE:-$PROJECT_DIR/.env}
ENV_CHAIN_SCRIPT=${ENV_CHAIN_SCRIPT:-$PROJECT_DIR/ops/common/env_chain.py}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/postgres}
VERIFY_DB_PREFIX=${VERIFY_DB_PREFIX:-frpclient_restore_verify}
MIN_TABLE_COUNT=${MIN_TABLE_COUNT:-10}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init postgres_verify
fi

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
fi

if [ "$IGNORE_DEPLOY_LOCK" != "1" ] && [ -f "$LOCK_SCRIPT" ] && sh "$LOCK_SCRIPT" is-held >/dev/null 2>&1; then
    echo "skip postgres backup verify: deploy lock is active"
    job_status_mark_skipped "deploy lock is active"
    job_status_finalize 0
    sh "$LOCK_SCRIPT" status || true
    exit 0
fi

usage() {
    cat <<'EOF'
Usage: sh ops/backup/postgres_verify_backup.sh [path/to/backup.sql.gz]

If no path is provided, the script verifies /var/backups/frpclient/postgres/latest.sql.gz.
The dump is restored into a temporary database and then dropped.
EOF
}

read_env_value() {
    secret_env_read_backend_value python3 "$PROJECT_DIR" "$1"
}

if [ "$#" -gt 1 ]; then
    usage >&2
    exit 1
fi

if docker compose version >/dev/null 2>&1; then
    compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
    compose() { docker-compose "$@"; }
else
    echo "docker compose or docker-compose is required" >&2
    exit 1
fi

secret_env_resolve_paths python3 "$PROJECT_DIR"
[ -f "$BACKEND_ENV_FILE" ] || { echo "backend env file not found: $BACKEND_ENV_FILE" >&2; exit 1; }
[ -f "$BACKEND_SECRETS_FILE" ] || { echo "backend secrets file not found: $BACKEND_SECRETS_FILE" >&2; exit 1; }

if [ "$#" -eq 1 ]; then
    DUMP_PATH=$1
else
    DUMP_PATH=$BACKUP_DIR/latest.sql.gz
fi

[ -f "$DUMP_PATH" ] || { echo "dump not found: $DUMP_PATH" >&2; exit 1; }

POSTGRES_USER=$(read_env_value POSTGRES_USER)
VERIFY_DB="${VERIFY_DB_PREFIX}_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
    compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$VERIFY_DB' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
    compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
        dropdb -U "$POSTGRES_USER" --if-exists "$VERIFY_DB" >/dev/null 2>&1 || true
}

finish() {
    exit_code=$1
    cleanup
    if [ "$exit_code" -eq 0 ]; then
        job_status_finalize 0
    else
        job_status_mark_failure "postgres verify failed"
        job_status_finalize "$exit_code"
    fi
}

trap 'exit_code=$?; finish "$exit_code"; exit "$exit_code"' EXIT INT TERM

gzip -t "$DUMP_PATH"

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    dropdb -U "$POSTGRES_USER" --if-exists "$VERIFY_DB" >/dev/null 2>&1 || true

compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$VERIFY_DB"

gunzip -c "$DUMP_PATH" | compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 >/dev/null

table_count=$(compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$VERIFY_DB" -At -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")

[ "$table_count" -ge "$MIN_TABLE_COUNT" ] || {
    echo "restored table count too low: $table_count" >&2
    exit 1
}

django_migrations=$(compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$VERIFY_DB" -At -v ON_ERROR_STOP=1 \
    -c "SELECT to_regclass('public.django_migrations') IS NOT NULL;")

accounts_user=$(compose -f "$PROJECT_DIR/docker-compose.prod.yml" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$VERIFY_DB" -At -v ON_ERROR_STOP=1 \
    -c "SELECT to_regclass('public.accounts_user') IS NOT NULL;")

[ "$django_migrations" = "t" ] || { echo "django_migrations table missing after restore" >&2; exit 1; }
[ "$accounts_user" = "t" ] || { echo "accounts_user table missing after restore" >&2; exit 1; }

job_status_mark_success "dump=$DUMP_PATH table_count=$table_count"
printf '%s\n' "backup verify passed: dump=$DUMP_PATH verify_db=$VERIFY_DB table_count=$table_count"
