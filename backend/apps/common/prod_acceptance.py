from __future__ import annotations

import asyncio
import json
import ssl
import time
from dataclasses import dataclass
from http.cookiejar import CookieJar
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPCookieProcessor, Request, build_opener

import websockets


USER_AGENT = "frpclient-prod-acceptance/1.0"


@dataclass
class AcceptanceSession:
    base_url: str
    opener: Any
    cookie_jar: CookieJar
    access_token: str = ""

    def json_request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        with_auth: bool = False,
    ) -> tuple[int, dict[str, Any], dict[str, str]]:
        data = None
        headers = {
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if with_auth:
            headers["Authorization"] = f"Bearer {self.access_token}"

        request = Request(urljoin(self.base_url, path), data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=20)
        except HTTPError as exc:
            response = exc
        except URLError as exc:
            raise RuntimeError(f"request failed for {path}: {exc}") from exc

        body = response.read().decode("utf-8", "replace")
        headers_lower = {key.lower(): value for key, value in response.headers.items()}
        parsed = json.loads(body) if body else {}
        return response.status, parsed, headers_lower

    def websocket_headers(self, ws_url: str) -> dict[str, str]:
        parsed = urlparse(ws_url)
        scheme = "https" if parsed.scheme == "wss" else "http"
        request = Request(parsed._replace(scheme=scheme).geturl())
        self.cookie_jar.add_cookie_header(request)
        cookie_header = request.get_header("Cookie")
        return {"Cookie": cookie_header} if cookie_header else {}


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def _make_ws_url(base_url: str, path: str) -> str:
    parsed = urlparse(base_url)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return f"{scheme}://{parsed.netloc}{path}"


async def _expect_ws_ping(ws_url: str, *, additional_headers: dict[str, str] | None = None) -> None:
    ssl_context = ssl.create_default_context() if ws_url.startswith("wss://") else None
    origin = f"{urlparse(ws_url).scheme.replace('ws', 'http')}://{urlparse(ws_url).netloc}"
    async with websockets.connect(
        ws_url,
        ssl=ssl_context,
        origin=origin,
        additional_headers=additional_headers,
        open_timeout=20,
        close_timeout=10,
    ) as websocket:
        await websocket.send(json.dumps({"type": "ping"}))
        payload = json.loads(await asyncio.wait_for(websocket.recv(), timeout=10))
        _assert(payload == {"type": "pong"}, f"unexpected websocket ping response for {ws_url}: {payload!r}")


async def _expect_appointment_event(
    ws_url: str,
    trigger,
    *,
    additional_headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    ssl_context = ssl.create_default_context() if ws_url.startswith("wss://") else None
    origin = f"{urlparse(ws_url).scheme.replace('ws', 'http')}://{urlparse(ws_url).netloc}"
    async with websockets.connect(
        ws_url,
        ssl=ssl_context,
        origin=origin,
        additional_headers=additional_headers,
        open_timeout=20,
        close_timeout=10,
    ) as websocket:
        await trigger()
        payload = json.loads(await asyncio.wait_for(websocket.recv(), timeout=15))
        _assert(payload.get("kind") == "platform_event", f"unexpected appointment event payload: {payload!r}")
        _assert(payload.get("event", {}).get("event_type") == "appointment.client_access_updated", payload)
        return payload


def run_acceptance(*, base_url: str, username: str, password: str) -> dict[str, Any]:
    normalized_base_url = base_url.rstrip("/") + "/"
    cookie_jar = CookieJar()
    opener = build_opener(HTTPCookieProcessor(cookie_jar))
    session = AcceptanceSession(base_url=normalized_base_url, opener=opener, cookie_jar=cookie_jar)

    status, payload, _headers = session.json_request(
        "/api/auth/login/",
        method="POST",
        payload={"username": username, "password": password},
    )
    _assert(status == 200, f"login returned {status}: {payload}")
    session.access_token = payload.get("access", "")
    _assert(session.access_token, f"login did not return access token: {payload}")
    _assert(payload.get("user", {}).get("username") == username, f"unexpected login user payload: {payload}")

    status, payload, _headers = session.json_request("/api/me/", with_auth=True)
    _assert(status == 200, f"/api/me/ returned {status}: {payload}")
    _assert(payload.get("user", {}).get("username") == username, payload)
    _assert(payload.get("user", {}).get("role") == "client", payload)

    status, payload, _headers = session.json_request("/api/dashboard/", with_auth=True)
    _assert(status == 200, f"/api/dashboard/ returned {status}: {payload}")
    _assert(payload.get("role") == "client", payload)

    notification_ws_url = _make_ws_url(normalized_base_url, "/ws/notifications/")
    asyncio.run(_expect_ws_ping(notification_ws_url, additional_headers=session.websocket_headers(notification_ws_url)))

    suffix = int(time.time())
    create_payload = {
        "brand": "SmokeTest",
        "model": f"prod-{suffix}",
        "lock_type": "GOOGLE",
        "has_pc": True,
        "contact_phone": "",
        "description": f"Production acceptance smoke {suffix}",
        "rustdesk_id": "",
        "rustdesk_password": "",
    }
    status, payload, _headers = session.json_request("/api/appointments/", method="POST", payload=create_payload, with_auth=True)
    _assert(status == 201, f"appointment create returned {status}: {payload}")
    appointment_id = payload.get("id")
    _assert(isinstance(appointment_id, int), f"appointment id missing: {payload}")
    _assert(payload.get("status") == "NEW", payload)

    status, payload, _headers = session.json_request("/api/appointments/my/", with_auth=True)
    _assert(status == 200, f"/api/appointments/my/ returned {status}: {payload}")
    _assert(any(item.get("id") == appointment_id for item in payload), f"created appointment not found in list: {payload}")

    status, payload, _headers = session.json_request(f"/api/appointments/{appointment_id}/", with_auth=True)
    _assert(status == 200, f"/api/appointments/{appointment_id}/ returned {status}: {payload}")
    _assert(payload.get("id") == appointment_id, payload)

    async def trigger_access_update() -> None:
        update_status, update_payload, _update_headers = await asyncio.to_thread(
            session.json_request,
            f"/api/appointments/{appointment_id}/client-access/",
            method="POST",
            payload={"rustdesk_id": "123456789", "rustdesk_password": "1234"},
            with_auth=True,
        )
        _assert(update_status == 200, f"client access update returned {update_status}: {update_payload}")

    appointment_ws_url = _make_ws_url(normalized_base_url, f"/ws/appointments/{appointment_id}/events/")
    event_payload = asyncio.run(
        _expect_appointment_event(
            appointment_ws_url,
            trigger_access_update,
            additional_headers=session.websocket_headers(appointment_ws_url),
        )
    )

    status, payload, _headers = session.json_request(f"/api/appointments/{appointment_id}/", with_auth=True)
    _assert(status == 200, f"final appointment detail returned {status}: {payload}")
    _assert(payload.get("rustdesk_id") == "123456789", payload)

    return {
        "ok": True,
        "base_url": normalized_base_url,
        "username": username,
        "appointment_id": appointment_id,
        "event_type": event_payload["event"]["event_type"],
    }
