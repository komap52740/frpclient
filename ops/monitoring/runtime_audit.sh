#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/frpclient/postgres}
MEDIA_BACKUP_DIR=${MEDIA_BACKUP_DIR:-/var/backups/frpclient/media}
BASE_URL=${BASE_URL:-https://frpclient.ru}
MAX_BACKUP_AGE_HOURS=${MAX_BACKUP_AGE_HOURS:-30}
MIN_BACKUP_SIZE_BYTES=${MIN_BACKUP_SIZE_BYTES:-1024}
MAX_MEDIA_BACKUP_AGE_HOURS=${MAX_MEDIA_BACKUP_AGE_HOURS:-30}
MIN_MEDIA_BACKUP_SIZE_BYTES=${MIN_MEDIA_BACKUP_SIZE_BYTES:-32}
MAX_ROOT_FS_USAGE_PERCENT=${MAX_ROOT_FS_USAGE_PERCENT:-90}
MIN_CERT_VALID_DAYS=${MIN_CERT_VALID_DAYS:-14}
REQUIRE_TELEGRAM_BOT=${REQUIRE_TELEGRAM_BOT:-1}
TELEGRAM_BOT_CONTAINER=${TELEGRAM_BOT_CONTAINER:-frp-telegram-bot}
REQUIRE_MEDIA_BACKUP_TIMER=${REQUIRE_MEDIA_BACKUP_TIMER:-0}
REQUIRE_MEDIA_VERIFY_TIMER=${REQUIRE_MEDIA_VERIFY_TIMER:-0}
REQUIRE_BACKUP_VERIFY_TIMER=${REQUIRE_BACKUP_VERIFY_TIMER:-0}
REQUIRE_OFFSITE_BACKUP_VERIFY_TIMER=${REQUIRE_OFFSITE_BACKUP_VERIFY_TIMER:-0}
REQUIRE_DJANGO_HOUSEKEEPING_TIMER=${REQUIRE_DJANGO_HOUSEKEEPING_TIMER:-0}
REQUIRE_PLATFORM_METRICS_TIMER=${REQUIRE_PLATFORM_METRICS_TIMER:-0}
REQUIRE_MANAGED_ACCEPTANCE_TIMER=${REQUIRE_MANAGED_ACCEPTANCE_TIMER:-0}
REQUIRE_CERTBOT_TIMER=${REQUIRE_CERTBOT_TIMER:-0}
REQUIRE_CERTBOT_DRY_RUN_TIMER=${REQUIRE_CERTBOT_DRY_RUN_TIMER:-0}
LOCK_SCRIPT=${LOCK_SCRIPT:-$PROJECT_DIR/ops/common/deploy_lock.sh}
JOB_STATUS_HELPER=${JOB_STATUS_HELPER:-$PROJECT_DIR/ops/common/job_status.sh}
DEPLOY_LOCK_DIR=${DEPLOY_LOCK_DIR:-$PROJECT_DIR/.deploy/active.lock}
DEPLOY_LOCK_METADATA_FILE=${DEPLOY_LOCK_METADATA_FILE:-$DEPLOY_LOCK_DIR/metadata}
MAINTENANCE_MARKER_PATH=${MAINTENANCE_MARKER_PATH:-$PROJECT_DIR/.deploy/maintenance-mode}
RELEASE_STATE_FILE=${RELEASE_STATE_FILE:-$PROJECT_DIR/.deploy/release/current.json}
RELEASE_STATE_STALE_AFTER_SECONDS=${RELEASE_STATE_STALE_AFTER_SECONDS:-2592000}
ROLLBACK_MANIFEST_DIR=${ROLLBACK_MANIFEST_DIR:-$PROJECT_DIR/.deploy/rollback/manifests}
IGNORE_DEPLOY_LOCK=${IGNORE_DEPLOY_LOCK:-0}
MAX_DEPLOY_LOCK_AGE_SECONDS=${MAX_DEPLOY_LOCK_AGE_SECONDS:-7200}
MAX_MAINTENANCE_AGE_SECONDS=${MAX_MAINTENANCE_AGE_SECONDS:-1800}
MAX_PUBLIC_SMOKE_SERVICE_AGE_SECONDS=${MAX_PUBLIC_SMOKE_SERVICE_AGE_SECONDS:-1800}
MAX_MEDIA_BACKUP_SERVICE_AGE_SECONDS=${MAX_MEDIA_BACKUP_SERVICE_AGE_SECONDS:-129600}
MAX_MEDIA_VERIFY_SERVICE_AGE_SECONDS=${MAX_MEDIA_VERIFY_SERVICE_AGE_SECONDS:-129600}
MAX_BACKUP_VERIFY_SERVICE_AGE_SECONDS=${MAX_BACKUP_VERIFY_SERVICE_AGE_SECONDS:-129600}
MAX_OFFSITE_BACKUP_VERIFY_SERVICE_AGE_SECONDS=${MAX_OFFSITE_BACKUP_VERIFY_SERVICE_AGE_SECONDS:-129600}
MAX_DJANGO_HOUSEKEEPING_SERVICE_AGE_SECONDS=${MAX_DJANGO_HOUSEKEEPING_SERVICE_AGE_SECONDS:-129600}
MAX_PLATFORM_METRICS_SERVICE_AGE_SECONDS=${MAX_PLATFORM_METRICS_SERVICE_AGE_SECONDS:-7200}
MAX_MANAGED_ACCEPTANCE_SERVICE_AGE_SECONDS=${MAX_MANAGED_ACCEPTANCE_SERVICE_AGE_SECONDS:-129600}
MAX_CERTBOT_DRY_RUN_SERVICE_AGE_SECONDS=${MAX_CERTBOT_DRY_RUN_SERVICE_AGE_SECONDS:-864000}
DEPLOY_LOCK_ACTIVE=0
MAINTENANCE_MODE_ACTIVE=0

if [ -f "$JOB_STATUS_HELPER" ]; then
    . "$JOB_STATUS_HELPER"
    job_status_init runtime_audit
    trap 'job_status_finalize "$?"' EXIT
fi

log() {
    printf '%s\n' "$*"
}

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

check_state_metadata_age() {
    state_name=$1
    metadata_path=$2
    timestamp_key=$3
    max_age_seconds=$4

    python3 - "$state_name" "$metadata_path" "$timestamp_key" "$max_age_seconds" <<'PY'
import datetime as dt
from pathlib import Path
import sys

state_name = sys.argv[1]
metadata_path = Path(sys.argv[2])
timestamp_key = sys.argv[3]
max_age_seconds = int(sys.argv[4])

if not metadata_path.exists():
    raise SystemExit(f"{state_name} metadata missing: {metadata_path}")

metadata = {}
for raw_line in metadata_path.read_text(encoding="utf-8").splitlines():
    if "=" not in raw_line:
        continue
    key, value = raw_line.split("=", 1)
    metadata[key.strip()] = value.strip()

raw_timestamp = metadata.get(timestamp_key, "")
if not raw_timestamp:
    raise SystemExit(f"{state_name} timestamp missing: {metadata_path}")

try:
    parsed_timestamp = dt.datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
except ValueError as exc:
    raise SystemExit(f"{state_name} timestamp invalid: {raw_timestamp}") from exc

if parsed_timestamp.tzinfo is None:
    parsed_timestamp = parsed_timestamp.replace(tzinfo=dt.timezone.utc)

age_seconds = int((dt.datetime.now(dt.timezone.utc) - parsed_timestamp.astimezone(dt.timezone.utc)).total_seconds())
if age_seconds < 0:
    raise SystemExit(f"{state_name} timestamp is in the future: {raw_timestamp}")
if age_seconds > max_age_seconds:
    raise SystemExit(
        f"{state_name} is too old: age_seconds={age_seconds} limit_seconds={max_age_seconds}"
    )

reason = metadata.get("reason", "") or "-"
print(f"{state_name} active age_seconds={age_seconds} reason={reason}")
PY
}

check_deploy_and_maintenance_state() {
    if [ -d "$DEPLOY_LOCK_DIR" ]; then
        DEPLOY_LOCK_ACTIVE=1
        check_state_metadata_age "deploy lock" "$DEPLOY_LOCK_METADATA_FILE" "locked_at" "$MAX_DEPLOY_LOCK_AGE_SECONDS"
    else
        log "deploy lock inactive: $DEPLOY_LOCK_DIR"
    fi

    if [ -f "$MAINTENANCE_MARKER_PATH" ]; then
        MAINTENANCE_MODE_ACTIVE=1
        check_state_metadata_age "maintenance mode" "$MAINTENANCE_MARKER_PATH" "enabled_at" "$MAX_MAINTENANCE_AGE_SECONDS"
    else
        log "maintenance mode inactive: $MAINTENANCE_MARKER_PATH"
    fi
}

check_active_unit() {
    unit_name=$1
    systemctl is-active --quiet "$unit_name" || fail "systemd unit is not active: $unit_name"
    log "unit ok: $unit_name"
}

check_recent_service_success() {
    service_name=$1
    max_age_seconds=$2

    python3 - "$service_name" "$max_age_seconds" <<'PY'
import datetime as dt
import subprocess
import sys

service_name = sys.argv[1]
max_age_seconds = int(sys.argv[2])

output = subprocess.check_output(
    [
        "systemctl",
        "show",
        service_name,
        "--property",
        "Result",
        "--property",
        "ExecMainStatus",
        "--property",
        "ExecMainExitTimestamp",
    ],
    text=True,
)

properties = {}
for raw_line in output.splitlines():
    if "=" not in raw_line:
        continue
    key, value = raw_line.split("=", 1)
    properties[key] = value

result = properties.get("Result", "")
status = properties.get("ExecMainStatus", "")
timestamp = properties.get("ExecMainExitTimestamp", "")

if result != "success":
    raise SystemExit(f"service last run failed: {service_name} result={result or 'unknown'}")
if status not in {"", "0"}:
    raise SystemExit(f"service last run returned non-zero status: {service_name} status={status}")
if not timestamp or timestamp == "n/a":
    raise SystemExit(f"service has no completed run timestamp yet: {service_name}")

try:
    completed_at = dt.datetime.strptime(timestamp, "%a %Y-%m-%d %H:%M:%S %Z").replace(tzinfo=dt.timezone.utc)
except ValueError as exc:
    raise SystemExit(f"failed to parse service timestamp for {service_name}: {timestamp}") from exc

age_seconds = int((dt.datetime.now(dt.timezone.utc) - completed_at).total_seconds())
if age_seconds > max_age_seconds:
    raise SystemExit(
        f"service last success is too old: {service_name} age_seconds={age_seconds} limit_seconds={max_age_seconds}"
    )

print(f"service ok: {service_name} age_seconds={age_seconds} result=success")
PY
}

check_container() {
    container_name=$1
    require_healthy=$2

    state=$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null) \
        || fail "container missing: $container_name"

    set -- $state
    status=$1
    health=${2:-none}

    [ "$status" = "running" ] || fail "container not running: $container_name ($status)"
    if [ "$require_healthy" = "1" ] && [ "$health" != "healthy" ]; then
        fail "container not healthy: $container_name ($health)"
    fi

    log "container ok: $container_name status=$status health=$health"
}

check_root_fs() {
    usage_percent=$(df -P / | awk 'NR == 2 {gsub("%", "", $5); print $5}')
    [ -n "$usage_percent" ] || fail "failed to read root filesystem usage"
    [ "$usage_percent" -lt "$MAX_ROOT_FS_USAGE_PERCENT" ] \
        || fail "root filesystem usage too high: ${usage_percent}%"
    log "disk ok: / usage=${usage_percent}%"
}

check_backup() {
    latest_link=$BACKUP_DIR/latest.sql.gz
    [ -e "$latest_link" ] || fail "backup link missing: $latest_link"

    backup_path=$(readlink -f "$latest_link")
    [ -f "$backup_path" ] || fail "backup target missing: $backup_path"

    backup_size=$(wc -c < "$backup_path")
    [ "$backup_size" -ge "$MIN_BACKUP_SIZE_BYTES" ] \
        || fail "backup is unexpectedly small: $backup_path (${backup_size} bytes)"

    now_epoch=$(date -u +%s)
    mtime_epoch=$(stat -c %Y "$backup_path")
    max_age_seconds=$((MAX_BACKUP_AGE_HOURS * 3600))
    age_seconds=$((now_epoch - mtime_epoch))
    [ "$age_seconds" -le "$max_age_seconds" ] \
        || fail "backup is too old: $backup_path (${age_seconds}s)"

    gzip -t "$backup_path"
    log "backup ok: $backup_path age_seconds=$age_seconds size_bytes=$backup_size"
}

check_media_backup() {
    latest_link=$MEDIA_BACKUP_DIR/latest.tar.gz
    [ -e "$latest_link" ] || fail "media backup link missing: $latest_link"

    backup_path=$(readlink -f "$latest_link")
    [ -f "$backup_path" ] || fail "media backup target missing: $backup_path"

    backup_size=$(wc -c < "$backup_path")
    [ "$backup_size" -ge "$MIN_MEDIA_BACKUP_SIZE_BYTES" ] \
        || fail "media backup is unexpectedly small: $backup_path (${backup_size} bytes)"

    now_epoch=$(date -u +%s)
    mtime_epoch=$(stat -c %Y "$backup_path")
    max_age_seconds=$((MAX_MEDIA_BACKUP_AGE_HOURS * 3600))
    age_seconds=$((now_epoch - mtime_epoch))
    [ "$age_seconds" -le "$max_age_seconds" ] \
        || fail "media backup is too old: $backup_path (${age_seconds}s)"

    tar -tzf "$backup_path" >/dev/null
    log "media backup ok: $backup_path age_seconds=$age_seconds size_bytes=$backup_size"
}

check_release_state() {
    python3 - "$RELEASE_STATE_FILE" "$RELEASE_STATE_STALE_AFTER_SECONDS" <<'PY'
import datetime as dt
import json
from pathlib import Path
import sys

path = Path(sys.argv[1])
stale_after_seconds = int(sys.argv[2])

if not path.exists():
    raise SystemExit(f"release state missing: {path}")

try:
    payload = json.loads(path.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    raise SystemExit(f"release state invalid: {path}: {exc}") from exc

action = str(payload.get("action") or "")
release_label = str(payload.get("release_label") or "")
source_fingerprint = str(payload.get("source_fingerprint") or "")
source_fingerprint_short = str(payload.get("source_fingerprint_short") or "") or source_fingerprint[:12]
git_commit = str(payload.get("git_commit") or "")
git_tag = str(payload.get("git_tag") or "")
reference_timestamp = (
    str(payload.get("finished_at") or "")
    or str(payload.get("updated_at") or "")
    or str(payload.get("started_at") or "")
)

if action not in {"deploy", "rollback"}:
    raise SystemExit(f"release state action invalid: {action or 'missing'}")
if not release_label:
    raise SystemExit("release state label missing")
if not reference_timestamp:
    raise SystemExit("release state timestamp missing")
if not (source_fingerprint or git_commit or git_tag):
    raise SystemExit("release state missing source metadata")

try:
    parsed_timestamp = dt.datetime.fromisoformat(reference_timestamp.replace("Z", "+00:00"))
except ValueError as exc:
    raise SystemExit(f"release state timestamp invalid: {reference_timestamp}") from exc

if parsed_timestamp.tzinfo is None:
    parsed_timestamp = parsed_timestamp.replace(tzinfo=dt.timezone.utc)

age_seconds = int((dt.datetime.now(dt.timezone.utc) - parsed_timestamp.astimezone(dt.timezone.utc)).total_seconds())
if age_seconds < 0:
    raise SystemExit(f"release state timestamp is in the future: {reference_timestamp}")
if age_seconds > stale_after_seconds:
    raise SystemExit(
        f"release state too old: age_seconds={age_seconds} limit_seconds={stale_after_seconds}"
    )

source_display = source_fingerprint_short or git_tag or git_commit
print(f"release state ok: action={action} label={release_label} source={source_display} age_seconds={age_seconds}")
PY
}

check_rollback_inventory() {
    python3 - "$ROLLBACK_MANIFEST_DIR" <<'PY'
from pathlib import Path
import sys

manifest_dir = Path(sys.argv[1])

if not manifest_dir.exists():
    raise SystemExit(f"rollback manifest dir missing: {manifest_dir}")
if not manifest_dir.is_dir():
    raise SystemExit(f"rollback manifest dir is not a directory: {manifest_dir}")

manifests = sorted(manifest_dir.glob("*.env"), reverse=True)
if not manifests:
    raise SystemExit("no rollback manifests available")

latest_manifest = manifests[0]
metadata = {}
for raw_line in latest_manifest.read_text(encoding="utf-8").splitlines():
    if "=" not in raw_line:
        continue
    key, value = raw_line.split("=", 1)
    metadata[key.strip()] = value.strip()

missing_keys = [
    key
    for key in ("COMPOSE_PROJECT_NAME", "IMAGE_BACKEND", "IMAGE_BACKEND_WS", "IMAGE_FRONTEND")
    if not metadata.get(key)
]
if missing_keys:
    raise SystemExit(
        f"latest rollback manifest missing keys: {', '.join(missing_keys)} ({latest_manifest})"
    )

source_fingerprint = metadata.get("SOURCE_FINGERPRINT", "")
source_fingerprint_short = metadata.get("SOURCE_FINGERPRINT_SHORT", "") or source_fingerprint[:12]
source_git_commit = metadata.get("SOURCE_GIT_COMMIT", "")
source_git_tag = metadata.get("SOURCE_GIT_TAG", "")
if not (source_fingerprint or source_git_commit or source_git_tag):
    raise SystemExit(f"latest rollback manifest missing source metadata: {latest_manifest}")

label = metadata.get("SNAPSHOT_LABEL", "") or latest_manifest.stem
source_display = source_fingerprint_short or source_git_tag or source_git_commit
print(f"rollback inventory ok: latest_label={label} source={source_display}")
PY
}

check_fail2ban() {
    check_active_unit fail2ban
    fail2ban-client status sshd >/dev/null 2>&1 || fail "fail2ban sshd jail is not active"
    log "fail2ban ok: sshd jail active"
}

check_public_health() {
    python3 - "$BASE_URL" <<'PY'
import json
import sys
import urllib.error
import urllib.request

base_url = sys.argv[1].rstrip("/")
targets = [
    (base_url + "/", None),
    (base_url + "/api/health/", "ok"),
]

for url, expected_status in targets:
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            body = response.read().decode("utf-8", "replace")
            if response.status != 200:
                raise SystemExit(f"unexpected status for {url}: {response.status}")
    except urllib.error.URLError as exc:
        raise SystemExit(f"request failed for {url}: {exc}") from exc

    if expected_status is not None:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"invalid json for {url}: {exc}") from exc
        if payload.get("status") != expected_status:
            raise SystemExit(f"unexpected payload for {url}: {payload}")

print(f"public health ok: {base_url}")
PY
}

check_tls_expiry() {
    python3 - "$BASE_URL" "$MIN_CERT_VALID_DAYS" <<'PY'
import datetime as dt
import socket
import ssl
import sys
from urllib.parse import urlparse

base_url = sys.argv[1]
min_days = int(sys.argv[2])
parsed = urlparse(base_url)
host = parsed.hostname
port = parsed.port or 443

if not host:
    raise SystemExit(f"invalid BASE_URL: {base_url}")

context = ssl.create_default_context()
with socket.create_connection((host, port), timeout=10) as raw_socket:
    with context.wrap_socket(raw_socket, server_hostname=host) as tls_socket:
        certificate = tls_socket.getpeercert()

not_after = certificate.get("notAfter")
if not not_after:
    raise SystemExit("certificate missing notAfter")

expires_at = dt.datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
remaining = expires_at - dt.datetime.utcnow()
remaining_days = remaining.total_seconds() / 86400

if remaining_days < min_days:
    raise SystemExit(f"certificate expires too soon: {remaining_days:.1f} days")

print(f"tls ok: {host} expires_at={expires_at.isoformat()}Z remaining_days={remaining_days:.1f}")
PY
}

require_command docker
require_command fail2ban-client
require_command gzip
require_command python3
require_command systemctl
require_command tar

check_deploy_and_maintenance_state
check_active_unit frpclient-postgres-backup.timer
if [ "$REQUIRE_MEDIA_BACKUP_TIMER" = "1" ]; then
    check_active_unit frpclient-media-backup.timer
    check_recent_service_success frpclient-media-backup.service "$MAX_MEDIA_BACKUP_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_MEDIA_VERIFY_TIMER" = "1" ]; then
    check_active_unit frpclient-media-verify.timer
    check_recent_service_success frpclient-media-verify.service "$MAX_MEDIA_VERIFY_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_OFFSITE_BACKUP_VERIFY_TIMER" = "1" ]; then
    check_active_unit frpclient-offsite-backup-verify.timer
    check_recent_service_success frpclient-offsite-backup-verify.service "$MAX_OFFSITE_BACKUP_VERIFY_SERVICE_AGE_SECONDS"
fi
check_active_unit frpclient-public-smoke.timer
check_recent_service_success frpclient-public-smoke.service "$MAX_PUBLIC_SMOKE_SERVICE_AGE_SECONDS"
if [ "$REQUIRE_BACKUP_VERIFY_TIMER" = "1" ]; then
    check_active_unit frpclient-postgres-verify.timer
    check_recent_service_success frpclient-postgres-verify.service "$MAX_BACKUP_VERIFY_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_DJANGO_HOUSEKEEPING_TIMER" = "1" ]; then
    check_active_unit frpclient-django-housekeeping.timer
    check_recent_service_success frpclient-django-housekeeping.service "$MAX_DJANGO_HOUSEKEEPING_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_PLATFORM_METRICS_TIMER" = "1" ]; then
    check_active_unit frpclient-platform-metrics.timer
    check_recent_service_success frpclient-platform-metrics.service "$MAX_PLATFORM_METRICS_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_MANAGED_ACCEPTANCE_TIMER" = "1" ]; then
    check_active_unit frpclient-managed-acceptance.timer
    check_recent_service_success frpclient-managed-acceptance.service "$MAX_MANAGED_ACCEPTANCE_SERVICE_AGE_SECONDS"
fi
if [ "$REQUIRE_CERTBOT_TIMER" = "1" ]; then
    check_active_unit certbot.timer
fi
if [ "$REQUIRE_CERTBOT_DRY_RUN_TIMER" = "1" ]; then
    check_active_unit frpclient-certbot-dry-run.timer
    check_recent_service_success frpclient-certbot-dry-run.service "$MAX_CERTBOT_DRY_RUN_SERVICE_AGE_SECONDS"
fi
check_fail2ban
check_root_fs
check_backup
if [ "$REQUIRE_MEDIA_BACKUP_TIMER" = "1" ]; then
    check_media_backup
fi
check_release_state
check_rollback_inventory

check_container frp-postgres 1
check_container frp-redis 1
check_container frp-backend 1
check_container frp-backend-ws 1
check_container frp-frontend 1

if [ "$REQUIRE_TELEGRAM_BOT" = "1" ]; then
    check_container "$TELEGRAM_BOT_CONTAINER" 0
fi

if [ "$MAINTENANCE_MODE_ACTIVE" = "1" ] && [ "$DEPLOY_LOCK_ACTIVE" = "1" ] && [ "$IGNORE_DEPLOY_LOCK" != "1" ]; then
    log "skip public health check: maintenance window is active during deploy/rollback"
else
    check_public_health
fi
check_tls_expiry

log "runtime audit passed"
job_status_mark_success "runtime audit passed"
