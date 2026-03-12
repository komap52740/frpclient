#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
MARKER_PATH=${MARKER_PATH:-$PROJECT_DIR/.deploy/maintenance-mode}
COMMAND=${1:-status}
REASON=${2:-manual}

timestamp() {
    date -u +%Y-%m-%dT%H:%M:%SZ
}

case "$COMMAND" in
    on|enable)
        mkdir -p "$(dirname "$MARKER_PATH")"
        {
            printf 'reason=%s\n' "$REASON"
            printf 'enabled_at=%s\n' "$(timestamp)"
        } > "$MARKER_PATH"
        echo "maintenance mode enabled: $MARKER_PATH reason=$REASON"
        ;;
    off|disable)
        rm -f "$MARKER_PATH"
        echo "maintenance mode disabled: $MARKER_PATH"
        ;;
    status)
        if [ -f "$MARKER_PATH" ]; then
            echo "maintenance mode enabled: $MARKER_PATH"
            cat "$MARKER_PATH"
        else
            echo "maintenance mode disabled: $MARKER_PATH"
        fi
        ;;
    *)
        echo "usage: sh ops/nginx/maintenance_mode.sh [on|off|status] [reason]" >&2
        exit 1
        ;;
esac
