#!/usr/bin/env sh

secret_env_resolve_paths() {
    python_bin=$1
    project_dir=$2
    env_chain_script=${ENV_CHAIN_SCRIPT:-$project_dir/ops/common/env_chain.py}

    ROOT_ENV_FILE=${ROOT_ENV_FILE:-$project_dir/.env}

    if [ -z "${BACKEND_ENV_FILE:-}" ]; then
        BACKEND_ENV_FILE=$(
            "$python_bin" "$env_chain_script" --allow-missing --file "$ROOT_ENV_FILE" --key BACKEND_ENV_FILE 2>/dev/null || true
        )
    fi
    if [ -z "${BACKEND_SECRETS_FILE:-}" ]; then
        BACKEND_SECRETS_FILE=$(
            "$python_bin" "$env_chain_script" --allow-missing --file "$ROOT_ENV_FILE" --key BACKEND_SECRETS_FILE 2>/dev/null || true
        )
    fi
    if [ -z "${FRONTEND_BUILD_SECRETS_FILE:-}" ]; then
        FRONTEND_BUILD_SECRETS_FILE=$(
            "$python_bin" "$env_chain_script" --allow-missing --file "$ROOT_ENV_FILE" --key FRONTEND_BUILD_SECRETS_FILE 2>/dev/null || true
        )
    fi

    BACKEND_ENV_FILE=${BACKEND_ENV_FILE:-$project_dir/backend/.env}
    BACKEND_SECRETS_FILE=${BACKEND_SECRETS_FILE:-/etc/frpclient/backend.secrets.env}
    FRONTEND_BUILD_SECRETS_FILE=${FRONTEND_BUILD_SECRETS_FILE:-/etc/frpclient/frontend.build.secrets.env}

    export ROOT_ENV_FILE BACKEND_ENV_FILE BACKEND_SECRETS_FILE FRONTEND_BUILD_SECRETS_FILE
}

secret_env_assert_files_exist() {
    [ -f "$BACKEND_ENV_FILE" ] || {
        echo "backend env file not found: $BACKEND_ENV_FILE" >&2
        return 1
    }
    [ -f "$BACKEND_SECRETS_FILE" ] || {
        echo "backend secrets file not found: $BACKEND_SECRETS_FILE" >&2
        return 1
    }
    [ -f "$FRONTEND_BUILD_SECRETS_FILE" ] || {
        echo "frontend build secrets file not found: $FRONTEND_BUILD_SECRETS_FILE" >&2
        return 1
    }
}

secret_env_export_frontend_build_vars() {
    python_bin=$1
    project_dir=$2
    env_chain_script=${ENV_CHAIN_SCRIPT:-$project_dir/ops/common/env_chain.py}

    secret_env_resolve_paths "$python_bin" "$project_dir"
    secret_env_assert_files_exist

    exports=$("$python_bin" "$env_chain_script" --file "$FRONTEND_BUILD_SECRETS_FILE" --format shell)
    if [ -n "$exports" ]; then
        eval "$exports"
    fi
}

secret_env_export_backend_vars() {
    python_bin=$1
    project_dir=$2
    env_chain_script=${ENV_CHAIN_SCRIPT:-$project_dir/ops/common/env_chain.py}

    secret_env_resolve_paths "$python_bin" "$project_dir"
    [ -f "$BACKEND_ENV_FILE" ] || {
        echo "backend env file not found: $BACKEND_ENV_FILE" >&2
        return 1
    }
    [ -f "$BACKEND_SECRETS_FILE" ] || {
        echo "backend secrets file not found: $BACKEND_SECRETS_FILE" >&2
        return 1
    }

    exports=$("$python_bin" "$env_chain_script" --file "$BACKEND_ENV_FILE" --file "$BACKEND_SECRETS_FILE" --format shell)
    if [ -n "$exports" ]; then
        eval "$exports"
    fi
}

secret_env_read_backend_value() {
    python_bin=$1
    project_dir=$2
    key=$3
    env_chain_script=${ENV_CHAIN_SCRIPT:-$project_dir/ops/common/env_chain.py}

    secret_env_resolve_paths "$python_bin" "$project_dir"
    "$python_bin" "$env_chain_script" --file "$BACKEND_ENV_FILE" --file "$BACKEND_SECRETS_FILE" --key "$key"
}
