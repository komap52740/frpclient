#!/usr/bin/env sh
set -eu

SOURCE_CONTAINER=${SOURCE_CONTAINER:-frp-backend}
SOURCE_PATH=${SOURCE_PATH:-/app/media}
PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
SECRET_ENV_HELPER=${SECRET_ENV_HELPER:-$PROJECT_DIR/ops/common/secret_env.sh}
MEDIA_STORAGE_SYNC_HELPER=${MEDIA_STORAGE_SYNC_HELPER:-$PROJECT_DIR/ops/backup/media_object_storage.py}
FORCE=0
ARCHIVE_PATH=

usage() {
    cat <<'EOF'
Usage: sh ops/backup/media_restore.sh /path/to/media-backup.tar.gz --force

Restores media files into the running backend media volume.
Use only after confirming the archive and understanding that current media files will be replaced.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --force)
            FORCE=1
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            if [ -z "$ARCHIVE_PATH" ]; then
                ARCHIVE_PATH=$1
            else
                usage >&2
                exit 1
            fi
            ;;
    esac
    shift
done

[ -n "$ARCHIVE_PATH" ] || { usage >&2; exit 1; }
[ -f "$ARCHIVE_PATH" ] || { echo "archive not found: $ARCHIVE_PATH" >&2; exit 1; }
[ "$FORCE" -eq 1 ] || { echo "refusing to restore without --force" >&2; exit 1; }

if [ -f "$SECRET_ENV_HELPER" ]; then
    . "$SECRET_ENV_HELPER"
    secret_env_export_backend_vars python3 "$PROJECT_DIR"
fi

tar -tzf "$ARCHIVE_PATH" >/dev/null

media_mode=$(python3 "$MEDIA_STORAGE_SYNC_HELPER" mode)
if [ "$media_mode" = "r2" ] || [ "$media_mode" = "s3" ]; then
    RESTORE_ROOT=$(mktemp -d)
    cleanup() {
        rm -rf "$RESTORE_ROOT"
    }
    trap cleanup EXIT INT TERM
    tar -xzf "$ARCHIVE_PATH" -C "$RESTORE_ROOT"
    [ -d "$RESTORE_ROOT/app/media" ] || { echo "media directory missing after extract: $ARCHIVE_PATH" >&2; exit 1; }
    python3 "$MEDIA_STORAGE_SYNC_HELPER" import --source "$RESTORE_ROOT/app/media" --wipe-remote
else
    docker inspect "$SOURCE_CONTAINER" >/dev/null 2>&1 || {
        echo "source container not found: $SOURCE_CONTAINER" >&2
        exit 1
    }

    docker exec "$SOURCE_CONTAINER" sh -c "mkdir -p '$SOURCE_PATH' && find '$SOURCE_PATH' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
    docker exec -i "$SOURCE_CONTAINER" sh -c "tar -C / -xzf -" < "$ARCHIVE_PATH"
fi

printf '%s\n' "media restore completed: archive=$ARCHIVE_PATH container=$SOURCE_CONTAINER path=$SOURCE_PATH"
