#!/usr/bin/env sh
set -eu

PROJECT_DIR=${PROJECT_DIR:-/var/www/FRPclient}
ADMIN_HOST=${ADMIN_HOST:-admin.frpclient.ru}
ACCESS_MODE=${ACCESS_MODE:-tailscale}
NGINX_SITES_AVAILABLE_DIR=${NGINX_SITES_AVAILABLE_DIR:-/etc/nginx/sites-available}
NGINX_SITES_ENABLED_DIR=${NGINX_SITES_ENABLED_DIR:-/etc/nginx/sites-enabled}
NGINX_SNIPPETS_DIR=${NGINX_SNIPPETS_DIR:-/etc/nginx/snippets}
TLS_TEMPLATE=${TLS_TEMPLATE:-$PROJECT_DIR/ops/nginx/admin.frpclient.ru.conf}
HTTP_TEMPLATE=${HTTP_TEMPLATE:-$PROJECT_DIR/ops/nginx/admin.frpclient.ru.http.conf}
TAILSCALE_SNIPPET=${TAILSCALE_SNIPPET:-$PROJECT_DIR/ops/nginx/snippets/frpclient-admin-access.tailscale.conf}
CLOUDFLARE_SNIPPET=${CLOUDFLARE_SNIPPET:-$PROJECT_DIR/ops/nginx/snippets/frpclient-admin-access.cloudflare-access.conf}
ACCESS_SNIPPET_DEST=${ACCESS_SNIPPET_DEST:-$NGINX_SNIPPETS_DIR/frpclient-admin-access.conf}
CERTBOT_EMAIL=${CERTBOT_EMAIL:-}
CERTBOT_WEBROOT=${CERTBOT_WEBROOT:-/var/www/certbot}
SITE_FILE_NAME=${SITE_FILE_NAME:-$ADMIN_HOST.conf}
SITE_AVAILABLE_PATH=$NGINX_SITES_AVAILABLE_DIR/$SITE_FILE_NAME
SITE_ENABLED_PATH=$NGINX_SITES_ENABLED_DIR/$SITE_FILE_NAME
CHECK_ONLY=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --check-only)
            CHECK_ONLY=1
            ;;
        --access-mode=*)
            ACCESS_MODE=${1#*=}
            ;;
        --access-mode)
            shift
            ACCESS_MODE=${1:-}
            ;;
        --certbot-email=*)
            CERTBOT_EMAIL=${1#*=}
            ;;
        --certbot-email)
            shift
            CERTBOT_EMAIL=${1:-}
            ;;
        *)
            echo "usage: sh ops/nginx/enable_admin_host.sh [--check-only] [--access-mode tailscale|cloudflare] [--certbot-email you@example.com]" >&2
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

require_file() {
    [ -f "$1" ] || {
        echo "required file not found: $1" >&2
        exit 1
    }
}

resolve_access_snippet() {
    case "$ACCESS_MODE" in
        tailscale)
            printf '%s\n' "$TAILSCALE_SNIPPET"
            ;;
        cloudflare)
            printf '%s\n' "$CLOUDFLARE_SNIPPET"
            ;;
        *)
            echo "unsupported ACCESS_MODE: $ACCESS_MODE" >&2
            exit 1
            ;;
    esac
}

assert_dns_resolves() {
    if getent ahostsv4 "$ADMIN_HOST" >/dev/null 2>&1 || getent ahosts "$ADMIN_HOST" >/dev/null 2>&1; then
        echo "dns ok: $ADMIN_HOST resolves"
        return 0
    fi
    echo "admin host does not resolve yet: $ADMIN_HOST" >&2
    exit 1
}

access_snippet_source=$(resolve_access_snippet)

require_command nginx
require_command certbot
require_command getent
require_file "$TLS_TEMPLATE"
require_file "$HTTP_TEMPLATE"
require_file "$access_snippet_source"
assert_dns_resolves

if [ "$CHECK_ONLY" = "1" ]; then
    echo "admin host enable precheck passed"
    echo "admin_host=$ADMIN_HOST"
    echo "access_mode=$ACCESS_MODE"
    echo "tls_template=$TLS_TEMPLATE"
    echo "http_template=$HTTP_TEMPLATE"
    echo "access_snippet=$access_snippet_source"
    exit 0
fi

[ -n "$CERTBOT_EMAIL" ] || {
    echo "CERTBOT_EMAIL must be set unless --check-only is used" >&2
    exit 1
}

mkdir -p "$NGINX_SITES_AVAILABLE_DIR" "$NGINX_SITES_ENABLED_DIR" "$NGINX_SNIPPETS_DIR" "$CERTBOT_WEBROOT/.well-known/acme-challenge"

install -m 644 "$access_snippet_source" "$ACCESS_SNIPPET_DEST"
install -m 644 "$HTTP_TEMPLATE" "$SITE_AVAILABLE_PATH"
ln -sf "$SITE_AVAILABLE_PATH" "$SITE_ENABLED_PATH"
nginx -t
systemctl reload nginx

certbot certonly \
    --webroot \
    --webroot-path "$CERTBOT_WEBROOT" \
    --non-interactive \
    --agree-tos \
    --keep-until-expiring \
    -m "$CERTBOT_EMAIL" \
    -d "$ADMIN_HOST"

install -m 644 "$TLS_TEMPLATE" "$SITE_AVAILABLE_PATH"
nginx -t
systemctl reload nginx

echo "admin host enabled: https://$ADMIN_HOST/django-admin/"
