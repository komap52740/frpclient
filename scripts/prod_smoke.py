from __future__ import annotations

import argparse
import json
import re
import sys
from collections import deque
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


class _ScriptSrcParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.asset_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key not in {"src", "href"} or not value:
                continue
            if not re.search(r"(?:^|/)(?:assets/)?[^/]+\.js(?:\?.*)?$", value):
                continue
            if value not in self.asset_urls:
                self.asset_urls.append(value)


def _fetch(url: str, *, accept: str = "*/*") -> tuple[int, str, dict[str, str]]:
    request = Request(url, headers={"Accept": accept, "User-Agent": "frpclient-prod-smoke/1.0"})
    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", "replace")
            headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, body, headers
    except HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        headers = {key.lower(): value for key, value in exc.headers.items()}
        return exc.code, body, headers
    except URLError as exc:
        raise RuntimeError(f"request failed for {url}: {exc}") from exc


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _iter_js_asset_refs(document: str) -> list[str]:
    refs: list[str] = []
    for match in re.finditer(r"""(?P<quote>["'])(?P<path>(?:/assets/|\.{1,2}/)[^"']+?\.js(?:\?[^"']*)?)(?P=quote)""", document):
        path = match.group("path")
        if path not in refs:
            refs.append(path)
    return refs


def _check_home(base_url: str) -> str:
    status, body, headers = _fetch(base_url, accept="text/html")
    _assert(status == 200, f"/ returned {status}, expected 200")
    _assert("text/html" in headers.get("content-type", ""), "/ did not return HTML")
    _assert("<html" in body.lower(), "/ did not look like HTML")
    return body


def _check_health(base_url: str) -> None:
    status, body, headers = _fetch(urljoin(base_url, "/api/health/"), accept="application/json")
    _assert(status == 200, f"/api/health/ returned {status}, expected 200")
    _assert("application/json" in headers.get("content-type", ""), "/api/health/ did not return JSON")
    payload = json.loads(body)
    _assert(payload.get("status") == "ok", f"/api/health/ status={payload.get('status')!r}")
    _assert(payload.get("service") == "frpclient-backend", f"/api/health/ service={payload.get('service')!r}")
    _assert("time" in payload, "/api/health/ did not include time")
    _assert("database" not in payload, "/api/health/ leaked database diagnostics")
    _assert("redis" not in payload, "/api/health/ leaked redis diagnostics")
    _assert("debug" not in payload, "/api/health/ leaked debug flag")


def _check_internal_liveness_is_not_public(base_url: str) -> None:
    status, _body, _headers = _fetch(urljoin(base_url, "/healthz"))
    _assert(status in {403, 404}, f"/healthz returned {status}, expected 403/404")


def _check_oauth_start(base_url: str, provider: str) -> None:
    status, body, headers = _fetch(urljoin(base_url, f"/api/auth/oauth/{provider}/start/"), accept="application/json")
    _assert(status == 200, f"{provider} start returned {status}, expected 200")
    _assert("application/json" in headers.get("content-type", ""), f"{provider} start did not return JSON")
    payload = json.loads(body)
    auth_url = payload.get("auth_url", "")
    _assert(auth_url, f"{provider} start did not include auth_url")
    parsed = urlparse(auth_url)
    expected_hosts = {
        "google": "accounts.google.com",
        "vk": "id.vk.com",
        "yandex": "oauth.yandex.ru",
        "max": "oauth.max.ru",
    }
    expected_host = expected_hosts.get(provider)
    if expected_host:
        _assert(parsed.netloc == expected_host, f"{provider} auth host={parsed.netloc!r}, expected {expected_host!r}")


def _check_telegram_marker(base_url: str, html: str, bot_username: str) -> None:
    parser = _ScriptSrcParser()
    parser.feed(html)
    _assert(parser.asset_urls, "could not find frontend JS assets on home page")

    queue = deque(urljoin(base_url, asset_path) for asset_path in parser.asset_urls)
    seen: set[str] = set()

    while queue and len(seen) < 120:
        asset_url = queue.popleft()
        if asset_url in seen:
            continue
        seen.add(asset_url)

        status, body, _headers = _fetch(asset_url, accept="application/javascript")
        _assert(status == 200, f"asset {asset_url} returned {status}, expected 200")
        if bot_username in body:
            return

        for match in _iter_js_asset_refs(body):
            next_url = urljoin(asset_url, match)
            if next_url not in seen:
                queue.append(next_url)

    raise RuntimeError(f"telegram bot username {bot_username!r} not found in frontend assets")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run smoke checks against a deployed FRP Client instance.")
    parser.add_argument("--base-url", default="https://frpclient.ru", help="Public base URL of the deployment.")
    parser.add_argument(
        "--oauth-provider",
        action="append",
        choices=["google", "vk", "yandex", "max"],
        default=[],
        help="OAuth provider start endpoint to validate. Can be passed multiple times.",
    )
    parser.add_argument(
        "--telegram-bot-username",
        default="",
        help="Expected Telegram bot username embedded in the frontend bundle.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/") + "/"
    html = _check_home(base_url)
    _check_internal_liveness_is_not_public(base_url)
    _check_health(base_url)

    for provider in args.oauth_provider:
        _check_oauth_start(base_url, provider)

    if args.telegram_bot_username:
        _check_telegram_marker(base_url, html, args.telegram_bot_username)

    print(f"prod smoke passed for {base_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
