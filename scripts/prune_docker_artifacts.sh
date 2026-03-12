#!/usr/bin/env sh
set -eu

PRUNE_DANGLING_IMAGES=${PRUNE_DANGLING_IMAGES:-1}

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "required command not found: $1" >&2
        exit 1
    }
}

require_command docker

if [ "$PRUNE_DANGLING_IMAGES" != "1" ]; then
    echo "docker prune skipped: PRUNE_DANGLING_IMAGES=$PRUNE_DANGLING_IMAGES"
    exit 0
fi

before_size=$(docker system df --format '{{.Type}} {{.Size}} {{.Reclaimable}}' 2>/dev/null || true)

echo "==> Prune dangling docker images"
docker image prune -f >/dev/null

after_size=$(docker system df --format '{{.Type}} {{.Size}} {{.Reclaimable}}' 2>/dev/null || true)

if [ -n "$before_size" ] || [ -n "$after_size" ]; then
    echo "==> Docker disk usage before"
    [ -n "$before_size" ] && printf '%s\n' "$before_size"
    echo "==> Docker disk usage after"
    [ -n "$after_size" ] && printf '%s\n' "$after_size"
fi
