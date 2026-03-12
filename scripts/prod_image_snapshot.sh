#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$REPO_DIR"

WITH_BOT=0
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-frpclient}
ROLLBACK_DIR=${ROLLBACK_DIR:-$REPO_DIR/.deploy/rollback}
SNAPSHOT_LABEL=${SNAPSHOT_LABEL:-$(date -u +%Y%m%dT%H%M%SZ)}
ROLLBACK_RETENTION_COUNT=${ROLLBACK_RETENTION_COUNT:-10}
SOURCE_METADATA_SCRIPT=${SOURCE_METADATA_SCRIPT:-$REPO_DIR/ops/common/source_metadata.py}

usage() {
    cat <<'EOF'
Usage: sh scripts/prod_image_snapshot.sh [--with-bot]

Creates rollback tags for the currently deployed production images and saves
their refs to .deploy/rollback/manifests/<timestamp>.env.
Keeps the newest ROLLBACK_RETENTION_COUNT manifests and removes older tags.
Prints the snapshot label to stdout, or "none" when nothing was snapshotted.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --with-bot)
            WITH_BOT=1
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "required command not found: $1" >&2
        exit 1
    }
}

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

require_command docker
PYTHON_BIN=$(resolve_python_bin)

MANIFEST_DIR=$ROLLBACK_DIR/manifests
mkdir -p "$MANIFEST_DIR"

case "$ROLLBACK_RETENTION_COUNT" in
    ''|*[!0-9]*)
        echo "ROLLBACK_RETENTION_COUNT must be a non-negative integer" >&2
        exit 1
        ;;
esac

manifest_path="$MANIFEST_DIR/$SNAPSHOT_LABEL.env"
tmp_manifest="$manifest_path.tmp"
current_release_state="$REPO_DIR/.deploy/release/current.json"

emit_source_metadata() {
    [ -f "$SOURCE_METADATA_SCRIPT" ] || return 0

    if [ -f "$current_release_state" ]; then
        "$PYTHON_BIN" "$SOURCE_METADATA_SCRIPT" \
            --mode release-state \
            --release-state "$current_release_state" \
            --format env 2>/dev/null || true
        return 0
    fi

    "$PYTHON_BIN" "$SOURCE_METADATA_SCRIPT" \
        --mode tree \
        --project-dir "$REPO_DIR" \
        --format env 2>/dev/null || true
}

write_header() {
    {
        printf 'SNAPSHOT_LABEL=%s\n' "$SNAPSHOT_LABEL"
        printf 'WITH_BOT=%s\n' "$WITH_BOT"
        printf 'COMPOSE_PROJECT_NAME=%s\n' "$COMPOSE_PROJECT_NAME"
        emit_source_metadata
    } >"$tmp_manifest"
}

snapshot_image() {
    service_name=$1
    container_name=$2
    canonical_ref=$3

    image_id=$(docker inspect -f '{{.Image}}' "$container_name" 2>/dev/null || true)
    if [ -z "$image_id" ]; then
        return 1
    fi

    snapshot_ref="${canonical_ref}:rollback-${SNAPSHOT_LABEL}"
    docker tag "$image_id" "$snapshot_ref"
    printf '%s=%s\n' "$service_name" "$snapshot_ref" >>"$tmp_manifest"
    return 0
}

write_header

snapshotted=0
snapshot_image IMAGE_BACKEND frp-backend "${COMPOSE_PROJECT_NAME}_backend" && snapshotted=1 || true
snapshot_image IMAGE_BACKEND_WS frp-backend-ws "${COMPOSE_PROJECT_NAME}_backend-ws" && snapshotted=1 || true
snapshot_image IMAGE_FRONTEND frp-frontend "${COMPOSE_PROJECT_NAME}_frontend" && snapshotted=1 || true
if [ "$WITH_BOT" -eq 1 ]; then
    snapshot_image IMAGE_TELEGRAM_BOT frp-telegram-bot "${COMPOSE_PROJECT_NAME}_telegram-bot" && snapshotted=1 || true
fi

cleanup_manifest() {
    target_manifest=$1

    [ -f "$target_manifest" ] || return 0

    while IFS='=' read -r key value; do
        case "$key" in
            IMAGE_BACKEND|IMAGE_BACKEND_WS|IMAGE_FRONTEND|IMAGE_TELEGRAM_BOT)
                [ -n "$value" ] || continue
                docker image inspect "$value" >/dev/null 2>&1 || continue
                docker image rm "$value" >/dev/null 2>&1 || true
                ;;
        esac
    done <"$target_manifest"

    rm -f "$target_manifest"
}

cleanup_old_manifests() {
    [ "$ROLLBACK_RETENTION_COUNT" -gt 0 ] || return 0

    manifest_list=$(find "$MANIFEST_DIR" -maxdepth 1 -type f -name '*.env' | sort)
    manifest_count=$(printf '%s\n' "$manifest_list" | sed '/^$/d' | wc -l | awk '{print $1}')

    [ "$manifest_count" -gt "$ROLLBACK_RETENTION_COUNT" ] || return 0

    prune_count=$((manifest_count - ROLLBACK_RETENTION_COUNT))
    printf '%s\n' "$manifest_list" | sed '/^$/d' | head -n "$prune_count" | while IFS= read -r old_manifest; do
        [ -n "$old_manifest" ] || continue
        cleanup_manifest "$old_manifest"
    done
}

if [ "$snapshotted" -eq 0 ]; then
    rm -f "$tmp_manifest"
    printf '%s\n' "none"
    exit 0
fi

mv "$tmp_manifest" "$manifest_path"
cleanup_old_manifests
printf '%s\n' "$SNAPSHOT_LABEL"
