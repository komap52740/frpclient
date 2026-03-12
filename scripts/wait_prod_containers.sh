#!/usr/bin/env sh
set -eu

CONTAINERS=${CONTAINERS:-frp-backend frp-backend-ws frp-frontend}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-60}
SLEEP_SECONDS=${SLEEP_SECONDS:-2}

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "required command not found: $1" >&2
        exit 1
    }
}

require_command docker

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    pending=0

    for container_name in $CONTAINERS; do
        state=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || true)
        [ -n "$state" ] || {
            echo "container not found: $container_name" >&2
            exit 1
        }

        set -- $state
        status=$1
        health=${2:-none}

        if [ "$status" != "running" ]; then
            pending=1
            break
        fi
        if [ "$health" != "none" ] && [ "$health" != "healthy" ]; then
            pending=1
            break
        fi
    done

    if [ "$pending" -eq 0 ]; then
        printf '%s\n' "prod containers ready"
        exit 0
    fi

    sleep "$SLEEP_SECONDS"
    attempt=$((attempt + 1))
done

printf '%s\n' "prod containers did not become healthy in time" >&2
exit 1
