#!/usr/bin/env sh

release_guard_resolve_metadata() {
    python_bin=$1
    project_dir=$2
    source_metadata_script=${3:-$project_dir/ops/common/source_metadata.py}

    [ -n "$python_bin" ] || {
        echo "python interpreter is required for release guard" >&2
        return 1
    }
    [ -n "$project_dir" ] || {
        echo "project directory is required for release guard" >&2
        return 1
    }
    [ -f "$source_metadata_script" ] || {
        echo "source metadata script not found: $source_metadata_script" >&2
        return 1
    }

    metadata_output=$(
        "$python_bin" "$source_metadata_script" \
            --mode repo \
            --project-dir "$project_dir" \
            --require-clean \
            --format env
    ) || return 1

    SOURCE_GIT_COMMIT=
    SOURCE_GIT_BRANCH=
    SOURCE_GIT_TAG=
    SOURCE_FINGERPRINT=
    SOURCE_FINGERPRINT_SHORT=
    SOURCE_GIT_CLEAN=0

    while IFS='=' read -r key value; do
        case "$key" in
            SOURCE_GIT_COMMIT)
                SOURCE_GIT_COMMIT=$value
                ;;
            SOURCE_GIT_BRANCH)
                SOURCE_GIT_BRANCH=$value
                ;;
            SOURCE_GIT_TAG)
                SOURCE_GIT_TAG=$value
                ;;
            SOURCE_FINGERPRINT)
                SOURCE_FINGERPRINT=$value
                ;;
            SOURCE_FINGERPRINT_SHORT)
                SOURCE_FINGERPRINT_SHORT=$value
                ;;
            SOURCE_GIT_CLEAN)
                SOURCE_GIT_CLEAN=$value
                ;;
        esac
    done <<EOF
$metadata_output
EOF

    [ -n "$SOURCE_GIT_COMMIT" ] || {
        echo "release guard failed: SOURCE_GIT_COMMIT is empty" >&2
        return 1
    }
    [ -n "$SOURCE_FINGERPRINT" ] || {
        echo "release guard failed: SOURCE_FINGERPRINT is empty" >&2
        return 1
    }
    [ "$SOURCE_GIT_CLEAN" = "1" ] || {
        echo "release guard failed: git worktree is not clean" >&2
        return 1
    }

    export SOURCE_GIT_COMMIT SOURCE_GIT_BRANCH SOURCE_GIT_TAG SOURCE_FINGERPRINT SOURCE_FINGERPRINT_SHORT SOURCE_GIT_CLEAN
}
