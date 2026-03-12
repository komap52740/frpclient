#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
SWAP_SIZE_MB=${SWAP_SIZE_MB:-2048}
SWAP_FILE=${SWAP_FILE:-/swapfile}

require_root() {
    if [ "$(id -u)" -ne 0 ]; then
        echo "run as root" >&2
        exit 1
    fi
}

create_swap_if_missing() {
    if swapon --show | grep -q .; then
        echo "swap already enabled"
        return 0
    fi

    if [ ! -f "$SWAP_FILE" ]; then
        if command -v fallocate >/dev/null 2>&1; then
            fallocate -l "${SWAP_SIZE_MB}M" "$SWAP_FILE"
        else
            dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$SWAP_SIZE_MB" status=progress
        fi
        chmod 600 "$SWAP_FILE"
        mkswap "$SWAP_FILE"
    fi

    swapon "$SWAP_FILE"
    grep -qF "$SWAP_FILE none swap sw 0 0" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
}

install_packages() {
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y fail2ban python3-systemd unattended-upgrades
}

install_configs() {
    install -d /etc/fail2ban/jail.d
    install -d /etc/sysctl.d
    install -d /etc/apt/apt.conf.d
    install -d /etc/ssh/sshd_config.d

    install -m 0644 "$PROJECT_DIR/ops/security/fail2ban/jail.d/sshd.local" /etc/fail2ban/jail.d/sshd.local
    install -m 0644 "$PROJECT_DIR/ops/security/sysctl/99-frpclient-vm.conf" /etc/sysctl.d/99-frpclient-vm.conf
    install -m 0644 "$PROJECT_DIR/ops/security/apt/20auto-upgrades" /etc/apt/apt.conf.d/20auto-upgrades
    install -m 0644 "$PROJECT_DIR/ops/security/apt/52frpclient-unattended-upgrades" /etc/apt/apt.conf.d/52frpclient-unattended-upgrades
    install -m 0644 "$PROJECT_DIR/ops/security/sshd_config.d/20-frpclient-safe.conf" /etc/ssh/sshd_config.d/20-frpclient-safe.conf
}

enable_services() {
    sysctl -q -p /etc/sysctl.d/99-frpclient-vm.conf >/dev/null
    sshd -t
    systemctl reload ssh
    systemctl enable --now fail2ban
    systemctl restart fail2ban
    systemctl enable --now unattended-upgrades
}

verify_services() {
    if ! fail2ban-client status sshd >/dev/null 2>&1; then
        echo "fail2ban sshd jail failed to start" >&2
        systemctl --no-pager -l status fail2ban || true
        tail -n 80 /var/log/fail2ban.log || true
        exit 1
    fi
}

show_status() {
    echo "--- swap ---"
    swapon --show
    echo "--- fail2ban ---"
    fail2ban-client status
    fail2ban-client status sshd
    echo "--- unattended-upgrades ---"
    systemctl is-enabled unattended-upgrades || true
    systemctl is-active unattended-upgrades || true
}

require_root
create_swap_if_missing
install_packages
install_configs
enable_services
verify_services
show_status
