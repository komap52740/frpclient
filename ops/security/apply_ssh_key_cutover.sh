#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
TARGET_USER=${TARGET_USER:-root}
PUBLIC_KEY_FILE=""
LOCKDOWN=0

usage() {
    cat <<'EOF'
Usage:
  sh ops/security/apply_ssh_key_cutover.sh --public-key-file /path/to/key.pub [--target-user root] [--lockdown]

What it does:
  1. installs the provided public key into TARGET_USER authorized_keys
  2. validates sshd configuration
  3. if --lockdown is provided, disables password SSH login and switches root to key-only login

Recommended flow:
  1. run without --lockdown
  2. verify a second SSH session using the key
  3. run again with --lockdown
EOF
}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "run as root" >&2
        exit 1
    fi
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --public-key-file)
                [ "$#" -ge 2 ] || { usage >&2; exit 1; }
                PUBLIC_KEY_FILE=$2
                shift 2
                ;;
            --target-user)
                [ "$#" -ge 2 ] || { usage >&2; exit 1; }
                TARGET_USER=$2
                shift 2
                ;;
            --lockdown)
                LOCKDOWN=1
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo "unknown argument: $1" >&2
                usage >&2
                exit 1
                ;;
        esac
    done
}

resolve_home_dir() {
    getent passwd "$TARGET_USER" | awk -F: '{print $6}'
}

install_key() {
    [ -n "$PUBLIC_KEY_FILE" ] || { usage >&2; exit 1; }
    [ -f "$PUBLIC_KEY_FILE" ] || { echo "public key file not found: $PUBLIC_KEY_FILE" >&2; exit 1; }

    home_dir=$(resolve_home_dir)
    [ -n "$home_dir" ] || { echo "failed to resolve home directory for $TARGET_USER" >&2; exit 1; }

    ssh_dir="$home_dir/.ssh"
    auth_keys="$ssh_dir/authorized_keys"
    public_key=$(tr -d '\r' < "$PUBLIC_KEY_FILE")

    [ -n "$public_key" ] || { echo "public key file is empty: $PUBLIC_KEY_FILE" >&2; exit 1; }

    install -d -m 0700 "$ssh_dir"
    touch "$auth_keys"
    chmod 0600 "$auth_keys"

    if ! grep -qxF "$public_key" "$auth_keys"; then
        printf '%s\n' "$public_key" >> "$auth_keys"
    fi

    chown "$TARGET_USER":"$TARGET_USER" "$ssh_dir" "$auth_keys"

    echo "authorized key installed for $TARGET_USER"
    if command -v ssh-keygen >/dev/null 2>&1; then
        ssh-keygen -lf "$PUBLIC_KEY_FILE" || true
    fi
}

apply_lockdown() {
    install -d /etc/ssh/sshd_config.d
    install -m 0644 "$PROJECT_DIR/ops/security/sshd_config.d/30-frpclient-key-only.conf" \
        /etc/ssh/sshd_config.d/30-frpclient-key-only.conf
    sshd -t
    systemctl reload ssh
    echo "ssh lockdown applied: password login disabled, root key-only login enabled"
}

require_root
parse_args "$@"
install_key
sshd -t

if [ "$LOCKDOWN" = "1" ]; then
    apply_lockdown
else
    echo "lockdown not applied; verify a second SSH session with the key, then rerun with --lockdown"
fi
