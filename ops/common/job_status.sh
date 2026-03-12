#!/usr/bin/env sh

job_status_now() {
    date -u +%Y-%m-%dT%H:%M:%SZ
}

job_status_duration_seconds() {
    if ! command -v python3 >/dev/null 2>&1; then
        printf '%s\n' "0"
        return 0
    fi

    python3 - "$1" "$2" <<'PY' 2>/dev/null || printf '%s\n' "0"
import datetime as dt
import sys

started_at = sys.argv[1]
finished_at = sys.argv[2]

try:
    started = dt.datetime.fromisoformat(started_at.replace("Z", "+00:00"))
    finished = dt.datetime.fromisoformat(finished_at.replace("Z", "+00:00"))
except ValueError:
    print("0")
    raise SystemExit(0)

if started.tzinfo is None:
    started = started.replace(tzinfo=dt.timezone.utc)
if finished.tzinfo is None:
    finished = finished.replace(tzinfo=dt.timezone.utc)

duration = max(0.0, (finished - started).total_seconds())
print(f"{duration:.3f}")
PY
}

job_status_write() {
    job_name=$1
    status=$2
    summary=${3:-}
    started_at=${4:-}
    finished_at=${5:-}
    duration_seconds=${6:-0}
    project_dir=${PROJECT_DIR:-/var/www/FRPclient}
    status_dir=${JOB_STATUS_DIR:-$project_dir/.deploy/status}
    status_file=$status_dir/$job_name.json
    tmp_file=$status_file.tmp.$$

    if ! command -v python3 >/dev/null 2>&1; then
        return 0
    fi
    mkdir -p "$status_dir" 2>/dev/null || return 0

    python3 - "$tmp_file" "$job_name" "$status" "$summary" "$started_at" "$finished_at" "$duration_seconds" <<'PY' 2>/dev/null || return 0
import json
import socket
import sys
from pathlib import Path
from datetime import datetime, timezone

tmp_file, job_name, status, summary, started_at, finished_at, duration_seconds = sys.argv[1:]
payload = {
    "job": job_name,
    "status": status,
    "summary": summary,
    "started_at": started_at,
    "finished_at": finished_at,
    "duration_seconds": float(duration_seconds or 0),
    "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "host": socket.gethostname() or "unknown",
}
Path(tmp_file).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
PY

    mv "$tmp_file" "$status_file" 2>/dev/null || true
    rm -f "$tmp_file" 2>/dev/null || true
    return 0
}

job_status_init() {
    JOB_STATUS_NAME=$1
    JOB_STATUS_STARTED_AT=$(job_status_now)
    JOB_STATUS_RESULT=running
    JOB_STATUS_SUMMARY=started
    job_status_write "$JOB_STATUS_NAME" "$JOB_STATUS_RESULT" "$JOB_STATUS_SUMMARY" "$JOB_STATUS_STARTED_AT" "" "0"
}

job_status_set_summary() {
    JOB_STATUS_SUMMARY=$1
}

job_status_mark_skipped() {
    JOB_STATUS_RESULT=skipped
    JOB_STATUS_SUMMARY=${1:-skipped}
}

job_status_mark_success() {
    JOB_STATUS_RESULT=success
    JOB_STATUS_SUMMARY=${1:-ok}
}

job_status_mark_failure() {
    JOB_STATUS_RESULT=failure
    JOB_STATUS_SUMMARY=${1:-failed}
}

job_status_finalize() {
    exit_code=${1:-0}
    finished_at=$(job_status_now)
    result=${JOB_STATUS_RESULT:-running}
    summary=${JOB_STATUS_SUMMARY:-}
    started_at=${JOB_STATUS_STARTED_AT:-$finished_at}

    if [ "$result" = "running" ]; then
        if [ "$exit_code" -eq 0 ]; then
            result=success
        else
            result=failure
        fi
    fi

    if [ "$result" = "failure" ] && { [ -z "$summary" ] || [ "$summary" = "started" ]; }; then
        summary="exit code $exit_code"
    fi

    duration_seconds=$(job_status_duration_seconds "$started_at" "$finished_at")
    job_status_write "${JOB_STATUS_NAME:-unknown}" "$result" "$summary" "$started_at" "$finished_at" "$duration_seconds"
    return 0
}
