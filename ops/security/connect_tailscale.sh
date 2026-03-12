#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

AUTH_KEY=${TAILSCALE_AUTH_KEY:-}
HOSTNAME=${TAILSCALE_HOSTNAME:-frpclient-prod}
ADVERTISE_TAGS=${TAILSCALE_ADVERTISE_TAGS:-}
ACCEPT_DNS=${TAILSCALE_ACCEPT_DNS:-true}
SSH_MODE=${TAILSCALE_SSH:-false}
RESET_MODE=0
CHECK_ONLY=0
FORCE_REAUTH=0

print_usage() {
    cat <<'EOF'
Usage: sh ops/security/connect_tailscale.sh [options]

Options:
  --auth-key VALUE         Tailscale auth key. Can also be provided via TAILSCALE_AUTH_KEY.
  --hostname NAME          Node hostname inside tailnet. Default: frpclient-prod
  --advertise-tags TAGS    Optional comma-separated tag list, for example tag:prod,tag:admin
  --accept-dns BOOL        true/false, default true
  --ssh                    Enable Tailscale SSH
  --force-reauth           Force re-auth even if node is already connected
  --reset                  Disconnect current node before running tailscale up
  --check-only             Only print current Tailscale state and exit
  --help                   Show this help
EOF
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "run as root" >&2
        exit 1
    fi
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

bool_flag() {
    case "${1:-}" in
        1|true|TRUE|yes|YES|on|ON) return 0 ;;
        *) return 1 ;;
    esac
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --auth-key)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --auth-key" >&2; exit 1; }
            AUTH_KEY=$1
            ;;
        --hostname)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --hostname" >&2; exit 1; }
            HOSTNAME=$1
            ;;
        --advertise-tags)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --advertise-tags" >&2; exit 1; }
            ADVERTISE_TAGS=$1
            ;;
        --accept-dns)
            shift
            [ "$#" -gt 0 ] || { echo "missing value for --accept-dns" >&2; exit 1; }
            ACCEPT_DNS=$1
            ;;
        --ssh)
            SSH_MODE=true
            ;;
        --force-reauth)
            FORCE_REAUTH=1
            ;;
        --reset)
            RESET_MODE=1
            ;;
        --check-only)
            CHECK_ONLY=1
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        *)
            echo "unknown option: $1" >&2
            print_usage >&2
            exit 1
            ;;
    esac
    shift
done

require_root

command_exists tailscale || {
    echo "tailscale binary is not installed" >&2
    exit 1
}

command_exists systemctl || {
    echo "systemctl is required" >&2
    exit 1
}

systemctl enable --now tailscaled >/dev/null 2>&1 || true

echo "==> tailscaled service"
systemctl is-active tailscaled

echo "==> tailscale version"
tailscale version

echo "==> current status"
tailscale status || true

if [ "$CHECK_ONLY" -eq 1 ]; then
    exit 0
fi

[ -n "$AUTH_KEY" ] || {
    echo "TAILSCALE_AUTH_KEY is required unless --check-only is used" >&2
    exit 1
}

if [ "$RESET_MODE" -eq 1 ]; then
    echo "==> reset current node state"
    tailscale logout || true
fi

set -- up --auth-key="$AUTH_KEY" --hostname="$HOSTNAME"

if bool_flag "$ACCEPT_DNS"; then
    set -- "$@" --accept-dns=true
else
    set -- "$@" --accept-dns=false
fi

if [ -n "$ADVERTISE_TAGS" ]; then
    set -- "$@" --advertise-tags="$ADVERTISE_TAGS"
fi

if bool_flag "$SSH_MODE"; then
    set -- "$@" --ssh
fi

if [ "$FORCE_REAUTH" -eq 1 ]; then
    set -- "$@" --force-reauth
fi

echo "==> tailscale up"
tailscale "$@"

echo "==> final status"
tailscale status
