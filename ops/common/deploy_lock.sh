#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
LOCK_DIR=${LOCK_DIR:-$PROJECT_DIR/.deploy/active.lock}
LOCK_METADATA_FILE=$LOCK_DIR/metadata
COMMAND=${1:-status}
REASON=${2:-manual}

timestamp() {
    date -u +%Y-%m-%dT%H:%M:%SZ
}

print_status() {
    if [ -d "$LOCK_DIR" ]; then
        echo "deploy lock active: $LOCK_DIR"
        if [ -f "$LOCK_METADATA_FILE" ]; then
            cat "$LOCK_METADATA_FILE"
        fi
    else
        echo "deploy lock inactive: $LOCK_DIR"
    fi
}

case "$COMMAND" in
    acquire)
        mkdir -p "$(dirname "$LOCK_DIR")"
        if mkdir "$LOCK_DIR" 2>/dev/null; then
            {
                printf 'reason=%s\n' "$REASON"
                printf 'locked_at=%s\n' "$(timestamp)"
                printf 'host=%s\n' "$(hostname 2>/dev/null || printf unknown)"
                printf 'pid=%s\n' "$$"
            } > "$LOCK_METADATA_FILE"
            echo "deploy lock acquired: $LOCK_DIR reason=$REASON"
        else
            echo "deploy lock already active: $LOCK_DIR" >&2
            if [ -f "$LOCK_METADATA_FILE" ]; then
                cat "$LOCK_METADATA_FILE" >&2
            fi
            exit 1
        fi
        ;;
    release)
        rm -rf "$LOCK_DIR"
        echo "deploy lock released: $LOCK_DIR"
        ;;
    is-held)
        [ -d "$LOCK_DIR" ]
        ;;
    status)
        print_status
        ;;
    *)
        echo "usage: sh ops/common/deploy_lock.sh [acquire|release|is-held|status] [reason]" >&2
        exit 1
        ;;
esac
