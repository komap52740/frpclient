from __future__ import annotations

import json
import logging
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.db.models import Q
from django.db import transaction
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import EmailVerificationToken, RoleChoices, SiteSettings, User, WholesaleStatusChoices
from .permissions import IsAuthenticatedAndNotBanned
from .services import recalculate_master_stats
from apps.platform.services import create_notification, emit_event
from apps.appointments.models import Appointment, AppointmentStatusChoices
from apps.chat.models import ReadState
from .serializers import (
    BootstrapAdminSerializer,
    MeSerializer,
    PasswordLoginSerializer,
    RegisterSerializer,
    ProfileUpdateSerializer,
    ResendVerificationSerializer,
    TelegramAuthSerializer,
    WholesaleRequestSerializer,
    WholesaleStatusSerializer,
    ClientProfileDetailSerializer,
)

logger = logging.getLogger(__name__)


def _oauth_cookie_name(provider: str) -> str:
    return f"oauth_state_{provider}"


def _frontend_base_url(request) -> str:
    configured = (settings.OAUTH_FRONTEND_URL or "").strip()
    if configured:
        return configured.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/")


def _oauth_login_url(request) -> str:
    base_url = _frontend_base_url(request)
    if base_url.endswith("/login"):
        return base_url
    return f"{base_url}/login"


def _oauth_redirect_uri(request, provider: str) -> str:
    if provider == "google" and settings.GOOGLE_OAUTH_REDIRECT_URI:
        return settings.GOOGLE_OAUTH_REDIRECT_URI
    if provider == "yandex" and settings.YANDEX_OAUTH_REDIRECT_URI:
        return settings.YANDEX_OAUTH_REDIRECT_URI
    if provider == "vk" and settings.VK_OAUTH_REDIRECT_URI:
        return settings.VK_OAUTH_REDIRECT_URI
    if provider == "max" and settings.MAX_OAUTH_REDIRECT_URI:
        return settings.MAX_OAUTH_REDIRECT_URI
    return f"{_frontend_base_url(request)}/api/auth/oauth/{provider}/callback/"


def _oauth_config(provider: str, request):
    if provider == "google":
        client_id = settings.GOOGLE_OAUTH_CLIENT_ID
        client_secret = settings.GOOGLE_OAUTH_CLIENT_SECRET
    elif provider == "yandex":
        client_id = settings.YANDEX_OAUTH_CLIENT_ID
        client_secret = settings.YANDEX_OAUTH_CLIENT_SECRET
    elif provider == "vk":
        client_id = settings.VK_OAUTH_CLIENT_ID
        client_secret = settings.VK_OAUTH_CLIENT_SECRET
    elif provider == "max":
        client_id = settings.MAX_OAUTH_CLIENT_ID
        client_secret = settings.MAX_OAUTH_CLIENT_SECRET
    else:
        return None

    if not client_id or not client_secret:
        return None

    config = {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": _oauth_redirect_uri(request, provider),
    }
    if provider == "vk":
        config.update(
            {
                "authorize_url": (settings.VK_OAUTH_AUTHORIZE_URL or "").strip(),
                "token_url": (settings.VK_OAUTH_TOKEN_URL or "").strip(),
                "userinfo_url": (settings.VK_OAUTH_USERINFO_URL or "").strip(),
                "scope": (settings.VK_OAUTH_SCOPE or "").strip() or "email",
                "api_version": (settings.VK_OAUTH_API_VERSION or "").strip() or "5.131",
            }
        )
        if not config["authorize_url"] or not config["token_url"] or not config["userinfo_url"]:
            return None
    if provider == "max":
        config.update(
            {
                "authorize_url": (settings.MAX_OAUTH_AUTHORIZE_URL or "").strip(),
                "token_url": (settings.MAX_OAUTH_TOKEN_URL or "").strip(),
                "userinfo_url": (settings.MAX_OAUTH_USERINFO_URL or "").strip(),
                "scope": (settings.MAX_OAUTH_SCOPE or "").strip() or "openid profile email",
            }
        )
        if not config["authorize_url"] or not config["token_url"] or not config["userinfo_url"]:
            return None
    return config


def _sanitize_username_seed(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    normalized = "".join(char if char.isalnum() or char in "._-" else "_" for char in raw)
    normalized = normalized.strip("._-")
    return normalized[:120]


def _build_unique_username(seed: str) -> str:
    base = _sanitize_username_seed(seed) or f"user_{get_random_string(6).lower()}"
    username = base
    index = 1
    while User.objects.filter(username=username).exists():
        suffix = f"_{index}"
        username = f"{base[: max(1, 150 - len(suffix))]}{suffix}"
        index += 1
    return username


def _fetch_json(url: str, *, method: str = "GET", form_data: dict | None = None, headers: dict | None = None) -> dict:
    request_headers = dict(headers or {})
    payload = None
    if form_data is not None:
        payload = urlencode(form_data).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")

    req = Request(url=url, data=payload, headers=request_headers, method=method)
    try:
        with urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        details = exc.read().decode("utf-8", "ignore")
        logger.warning("OAuth HTTPError %s for %s: %s", exc.code, url, details[:400])
        raise ValueError("oauth_http_error") from exc
    except (URLError, TimeoutError, ValueError) as exc:
        logger.warning("OAuth request failed for %s: %s", url, exc)
        raise ValueError("oauth_request_failed") from exc


def _google_authorize_url(config: dict, state: str) -> str:
    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


def _yandex_authorize_url(config: dict, state: str) -> str:
    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "state": state,
        "force_confirm": "yes",
    }
    return f"https://oauth.yandex.ru/authorize?{urlencode(params)}"


def _vk_authorize_url(config: dict, state: str) -> str:
    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "state": state,
        "scope": config.get("scope") or "email",
        "v": config.get("api_version") or "5.131",
    }
    return f"{config['authorize_url']}?{urlencode(params)}"


def _max_authorize_url(config: dict, state: str) -> str:
    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "state": state,
        "scope": config.get("scope") or "openid profile email",
    }
    return f"{config['authorize_url']}?{urlencode(params)}"


def _load_google_profile(config: dict, code: str) -> dict:
    token_data = _fetch_json(
        "https://oauth2.googleapis.com/token",
        method="POST",
        form_data={
            "code": code,
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "redirect_uri": config["redirect_uri"],
            "grant_type": "authorization_code",
        },
    )
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("oauth_missing_access_token")
    return _fetch_json(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _load_yandex_profile(config: dict, code: str) -> dict:
    token_data = _fetch_json(
        "https://oauth.yandex.ru/token",
        method="POST",
        form_data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
        },
    )
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("oauth_missing_access_token")
    return _fetch_json(
        "https://login.yandex.ru/info?format=json",
        headers={"Authorization": f"OAuth {access_token}"},
    )


def _load_vk_profile(config: dict, code: str) -> dict:
    token_data = _fetch_json(
        f"{config['token_url']}?{urlencode({'client_id': config['client_id'], 'client_secret': config['client_secret'], 'redirect_uri': config['redirect_uri'], 'code': code})}"
    )
    if token_data.get("error"):
        raise ValueError("oauth_token_error")
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("oauth_missing_access_token")

    user_data = _fetch_json(
        f"{config['userinfo_url']}?{urlencode({'access_token': access_token, 'v': config.get('api_version') or '5.131', 'fields': 'screen_name,photo_200'})}"
    )
    if user_data.get("error"):
        raise ValueError("oauth_userinfo_error")

    user_payload = {}
    response_items = user_data.get("response") or []
    if isinstance(response_items, list) and response_items:
        user_payload = response_items[0] or {}

    return {
        "id": user_payload.get("id") or token_data.get("user_id"),
        "email": token_data.get("email") or "",
        "first_name": user_payload.get("first_name") or "",
        "last_name": user_payload.get("last_name") or "",
        "username": user_payload.get("screen_name") or "",
    }


def _load_max_profile(config: dict, code: str) -> dict:
    token_data = _fetch_json(
        config["token_url"],
        method="POST",
        form_data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "redirect_uri": config["redirect_uri"],
        },
    )
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError("oauth_missing_access_token")
    return _fetch_json(
        config["userinfo_url"],
        headers={"Authorization": f"Bearer {access_token}"},
    )


def _normalize_oauth_profile(provider: str, raw_profile: dict) -> dict:
    if provider == "google":
        external_id = str(raw_profile.get("sub") or "").strip()
        email = (raw_profile.get("email") or "").strip().lower()
        email_verified = raw_profile.get("email_verified")
        if email and email_verified is False:
            email = ""
        first_name = (raw_profile.get("given_name") or "").strip()
        last_name = (raw_profile.get("family_name") or "").strip()
        username_seed = (email.split("@", 1)[0] if email else "") or raw_profile.get("name") or f"google_{external_id[-10:]}"
        return {
            "external_id": external_id,
            "email": email,
            "username_seed": str(username_seed),
            "first_name": first_name,
            "last_name": last_name,
        }

    if provider == "yandex":
        external_id = str(raw_profile.get("id") or "").strip()
        email = (raw_profile.get("default_email") or "").strip().lower()
        login = (raw_profile.get("login") or "").strip()
        first_name = (raw_profile.get("first_name") or "").strip()
        last_name = (raw_profile.get("last_name") or "").strip()
        username_seed = login or (email.split("@", 1)[0] if email else "") or f"yandex_{external_id[-10:]}"
        return {
            "external_id": external_id,
            "email": email,
            "username_seed": str(username_seed),
            "first_name": first_name,
            "last_name": last_name,
        }

    if provider == "vk":
        external_id = str(raw_profile.get("id") or raw_profile.get("user_id") or "").strip()
        email = (raw_profile.get("email") or "").strip().lower()
        login = (raw_profile.get("username") or raw_profile.get("screen_name") or "").strip()
        first_name = (raw_profile.get("first_name") or "").strip()
        last_name = (raw_profile.get("last_name") or "").strip()
        suffix = external_id[-10:] if external_id else get_random_string(6).lower()
        username_seed = login or (email.split("@", 1)[0] if email else "") or f"vk_{suffix}"
        return {
            "external_id": external_id,
            "email": email,
            "username_seed": str(username_seed),
            "first_name": first_name,
            "last_name": last_name,
        }

    external_id = str(raw_profile.get("id") or raw_profile.get("sub") or raw_profile.get("user_id") or "").strip()
    email = (raw_profile.get("email") or raw_profile.get("default_email") or "").strip().lower()
    login = (raw_profile.get("username") or raw_profile.get("login") or "").strip()
    first_name = (raw_profile.get("first_name") or raw_profile.get("given_name") or "").strip()
    last_name = (raw_profile.get("last_name") or raw_profile.get("family_name") or "").strip()
    name = (raw_profile.get("name") or "").strip()
    suffix = external_id[-10:] if external_id else get_random_string(6).lower()
    username_seed = login or (email.split("@", 1)[0] if email else "") or name or f"max_{suffix}"
    return {
        "external_id": external_id,
        "email": email,
        "username_seed": str(username_seed),
        "first_name": first_name,
        "last_name": last_name,
    }


def _get_or_create_oauth_user(provider: str, profile: dict) -> User:
    email = profile.get("email") or ""
    username_seed = profile.get("username_seed") or ""

    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    if not user and username_seed:
        user = User.objects.filter(username=username_seed).first()

    if not user:
        username = _build_unique_username(username_seed or f"{provider}_{profile.get('external_id', '')}")
        user = User.objects.create_user(
            username=username,
            password=get_random_string(32),
            role=RoleChoices.CLIENT,
            email=email,
            first_name=profile.get("first_name", ""),
            last_name=profile.get("last_name", ""),
        )
    else:
        updated = False
        if email and user.email != email:
            user.email = email
            updated = True
        if profile.get("first_name") and user.first_name != profile["first_name"]:
            user.first_name = profile["first_name"]
            updated = True
        if profile.get("last_name") and user.last_name != profile["last_name"]:
            user.last_name = profile["last_name"]
            updated = True
        if updated:
            user.save(update_fields=["email", "first_name", "last_name", "updated_at"])

    user.last_login = timezone.now()
    user.save(update_fields=["last_login", "updated_at"])
    return user


def _oauth_redirect_with_error(request, message: str, provider: str = "") -> HttpResponseRedirect:
    params = {"oauth_error": message}
    if provider:
        params["oauth_provider"] = provider
    return HttpResponseRedirect(f"{_oauth_login_url(request)}#{urlencode(params)}")


def _oauth_success_response(request, user: User, provider: str) -> HttpResponseRedirect:
    refresh = RefreshToken.for_user(user)
    access = str(refresh.access_token)
    redirect = HttpResponseRedirect(
        f"{_oauth_login_url(request)}#{urlencode({'oauth_access': access, 'oauth_provider': provider})}"
    )
    redirect.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=str(refresh),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        max_age=int(refresh.lifetime.total_seconds()),
    )
    return redirect


def _email_verify_url(request) -> str:
    configured = (settings.EMAIL_VERIFICATION_URL or "").strip()
    if configured:
        return configured
    return request.build_absolute_uri("/api/auth/verify-email/")


def _email_verify_link(request, token: str) -> str:
    base_url = _email_verify_url(request)
    delimiter = "&" if "?" in base_url else "?"
    return f"{base_url}{delimiter}{urlencode({'token': token})}"


def _email_verify_redirect(request, *, verified: bool = False, error_message: str = "") -> HttpResponseRedirect:
    params = {"email_verified": "1"} if verified else {"email_error": error_message or "Не удалось подтвердить email."}
    return HttpResponseRedirect(f"{_oauth_login_url(request)}#{urlencode(params)}")


def _expire_active_email_tokens(user: User) -> None:
    EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())


def _create_email_verification_token(user: User) -> EmailVerificationToken:
    _expire_active_email_tokens(user)
    ttl_hours = max(int(getattr(settings, "EMAIL_VERIFICATION_TTL_HOURS", 24)), 1)
    return EmailVerificationToken.objects.create(
        user=user,
        token=get_random_string(64),
        expires_at=timezone.now() + timedelta(hours=ttl_hours),
    )


def _send_email_verification_message(request, user: User, verification_token: EmailVerificationToken) -> bool:
    if not settings.EMAIL_HOST:
        return False

    verify_link = _email_verify_link(request, verification_token.token)
    ttl_hours = max(int(getattr(settings, "EMAIL_VERIFICATION_TTL_HOURS", 24)), 1)
    subject = "Подтверждение email в FRP Client"
    message = (
        "Вы зарегистрировались в FRP Client.\n\n"
        "Подтвердите email по ссылке:\n"
        f"{verify_link}\n\n"
        f"Ссылка действует {ttl_hours} ч.\n"
        "Если это были не вы, просто проигнорируйте письмо."
    )
    delivered = send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    return bool(delivered)


def admin_accounts_count() -> int:
    return User.objects.filter(role=RoleChoices.ADMIN).count() + User.objects.filter(is_superuser=True).exclude(role=RoleChoices.ADMIN).count()


def build_auth_response(user: User) -> Response:
    refresh = RefreshToken.for_user(user)
    payload = {
        "access": str(refresh.access_token),
        "user": MeSerializer(user).data,
    }
    response = Response(payload, status=status.HTTP_200_OK)
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=str(refresh),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        max_age=int(refresh.lifetime.total_seconds()),
    )
    return response


class TelegramAuthView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = TelegramAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        telegram_id = data["id"]
        user = User.objects.filter(telegram_id=telegram_id).first()
        if not user:
            username_base = f"tg_{telegram_id}"
            username = username_base
            index = 1
            while User.objects.filter(username=username).exists():
                index += 1
                username = f"{username_base}_{index}"

            user = User.objects.create_user(
                username=username,
                password=get_random_string(32),
                telegram_id=telegram_id,
                telegram_username=data.get("username") or "",
                telegram_photo_url=data.get("photo_url") or "",
                first_name=data.get("first_name") or "",
                last_name=data.get("last_name") or "",
                role=RoleChoices.CLIENT,
            )
        else:
            user.telegram_username = data.get("username") or user.telegram_username
            user.telegram_photo_url = data.get("photo_url") or user.telegram_photo_url
            user.first_name = data.get("first_name") or user.first_name
            user.last_name = data.get("last_name") or user.last_name
            user.last_login = timezone.now()
            user.save(
                update_fields=[
                    "telegram_username",
                    "telegram_photo_url",
                    "first_name",
                    "last_name",
                    "last_login",
                    "updated_at",
                ]
            )

        return build_auth_response(user)


class PasswordLoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]
        candidate = User.objects.filter(username=username).first()
        if (
            candidate
            and not candidate.is_active
            and bool((candidate.email or "").strip())
            and not candidate.is_email_verified
        ):
            return Response(
                {"detail": "Email не подтвержден. Проверьте почту и перейдите по ссылке подтверждения."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user = authenticate(request=request, username=username, password=password)
        if not user:
            return Response({"detail": "Неверный логин или пароль."}, status=status.HTTP_401_UNAUTHORIZED)
        if user.is_banned and user.role == RoleChoices.CLIENT:
            return Response({"detail": "Ваш аккаунт заблокирован администратором."}, status=status.HTTP_403_FORBIDDEN)

        user.last_login = timezone.now()
        user.save(update_fields=["last_login", "updated_at"])
        return build_auth_response(user)


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        with transaction.atomic():
            user = User.objects.create_user(
                username=payload["username"],
                email=payload["email"],
                password=payload["password"],
                role=RoleChoices.CLIENT,
                is_active=False,
                is_email_verified=False,
            )
            verification_token = _create_email_verification_token(user)

        delivered = False
        try:
            delivered = _send_email_verification_message(request, user, verification_token)
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Email verification send failed for user=%s: %s", user.id, exc)

        message = (
            "Аккаунт создан. Проверьте почту и подтвердите email."
            if delivered
            else "Аккаунт создан, но письмо не отправлено. Нажмите «Отправить письмо повторно» на странице входа."
        )
        return Response(
            {
                "detail": message,
                "email": user.email,
                "verification_sent": delivered,
            },
            status=status.HTTP_201_CREATED,
        )


class RegisterResendVerificationView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, role=RoleChoices.CLIENT).first()
        if not user or user.is_email_verified:
            return Response(
                {"detail": "Если аккаунт с таким email существует, письмо отправлено."},
                status=status.HTTP_200_OK,
            )

        verification_token = _create_email_verification_token(user)
        delivered = False
        try:
            delivered = _send_email_verification_message(request, user, verification_token)
        except Exception as exc:  # pragma: no cover - network dependent
            logger.warning("Resend verification failed for user=%s: %s", user.id, exc)

        if delivered:
            return Response(
                {"detail": "Письмо подтверждения отправлено повторно."},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"detail": "Не удалось отправить письмо. Проверьте SMTP-настройки сервера."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class EmailVerifyView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        token = (request.GET.get("token") or "").strip()
        if not token:
            return _email_verify_redirect(request, error_message="Ссылка подтверждения недействительна.")

        verification = EmailVerificationToken.objects.select_related("user").filter(token=token).first()
        if not verification:
            return _email_verify_redirect(request, error_message="Ссылка подтверждения недействительна.")

        if verification.used_at is not None:
            if verification.user.is_email_verified:
                return _email_verify_redirect(request, verified=True)
            return _email_verify_redirect(request, error_message="Ссылка подтверждения уже использована.")

        if verification.is_expired:
            return _email_verify_redirect(request, error_message="Срок действия ссылки истек.")

        user = verification.user
        now = timezone.now()
        with transaction.atomic():
            verification.used_at = now
            verification.save(update_fields=["used_at", "updated_at"])
            user.is_active = True
            user.is_email_verified = True
            user.email_verified_at = now
            user.save(update_fields=["is_active", "is_email_verified", "email_verified_at", "updated_at"])
            EmailVerificationToken.objects.filter(user=user, used_at__isnull=True).exclude(id=verification.id).update(used_at=now)

        return _email_verify_redirect(request, verified=True)


class OAuthStartView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, provider: str):
        normalized_provider = (provider or "").lower()
        config = _oauth_config(normalized_provider, request)
        if not config:
            return Response({"detail": "OAuth для выбранного провайдера не настроен."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        state = get_random_string(40)
        if normalized_provider == "google":
            auth_url = _google_authorize_url(config, state)
        elif normalized_provider == "yandex":
            auth_url = _yandex_authorize_url(config, state)
        elif normalized_provider == "vk":
            auth_url = _vk_authorize_url(config, state)
        elif normalized_provider == "max":
            auth_url = _max_authorize_url(config, state)
        else:
            return Response({"detail": "Неизвестный OAuth-провайдер."}, status=status.HTTP_404_NOT_FOUND)

        response = Response({"provider": normalized_provider, "auth_url": auth_url}, status=status.HTTP_200_OK)
        response.set_cookie(
            key=_oauth_cookie_name(normalized_provider),
            value=state,
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            max_age=600,
        )
        return response


class OAuthCallbackView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, provider: str):
        normalized_provider = (provider or "").lower()
        if normalized_provider not in {"google", "yandex", "vk", "max"}:
            return _oauth_redirect_with_error(request, "Неизвестный OAuth-провайдер.")

        oauth_error = (request.GET.get("error_description") or request.GET.get("error") or "").strip()
        if oauth_error:
            response = _oauth_redirect_with_error(request, oauth_error, normalized_provider)
            response.delete_cookie(_oauth_cookie_name(normalized_provider))
            return response

        received_state = (request.GET.get("state") or "").strip()
        expected_state = request.COOKIES.get(_oauth_cookie_name(normalized_provider), "")
        if not received_state or not expected_state or received_state != expected_state:
            response = _oauth_redirect_with_error(request, "OAuth-сессия недействительна. Повторите вход.", normalized_provider)
            response.delete_cookie(_oauth_cookie_name(normalized_provider))
            return response

        code = (request.GET.get("code") or "").strip()
        if not code:
            response = _oauth_redirect_with_error(request, "OAuth-код не получен.", normalized_provider)
            response.delete_cookie(_oauth_cookie_name(normalized_provider))
            return response

        config = _oauth_config(normalized_provider, request)
        if not config:
            response = _oauth_redirect_with_error(request, "OAuth для выбранного провайдера не настроен.", normalized_provider)
            response.delete_cookie(_oauth_cookie_name(normalized_provider))
            return response

        try:
            if normalized_provider == "google":
                raw_profile = _load_google_profile(config, code)
            elif normalized_provider == "yandex":
                raw_profile = _load_yandex_profile(config, code)
            elif normalized_provider == "vk":
                raw_profile = _load_vk_profile(config, code)
            else:
                raw_profile = _load_max_profile(config, code)
            profile = _normalize_oauth_profile(normalized_provider, raw_profile)
            user = _get_or_create_oauth_user(normalized_provider, profile)
        except Exception as exc:  # noqa: BLE001
            logger.warning("OAuth callback failed for provider=%s: %s", normalized_provider, exc)
            response = _oauth_redirect_with_error(request, "Не удалось выполнить вход. Попробуйте снова.", normalized_provider)
            response.delete_cookie(_oauth_cookie_name(normalized_provider))
            return response

        response = _oauth_success_response(request, user, normalized_provider)
        response.delete_cookie(_oauth_cookie_name(normalized_provider))
        return response


class AuthLogoutView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        response = Response({"success": True}, status=status.HTTP_200_OK)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME)
        return response


class BootstrapStatusView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        count = admin_accounts_count()
        return Response(
            {
                "requires_setup": count == 0,
                "admin_accounts_count": count,
            },
            status=status.HTTP_200_OK,
        )


class BootstrapCreateAdminView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        if admin_accounts_count() > 0:
            return Response({"detail": "Первичная настройка уже завершена."}, status=status.HTTP_409_CONFLICT)

        serializer = BootstrapAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User.objects.create_user(
            username=data["username"],
            password=data["password"],
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            role=RoleChoices.ADMIN,
            is_staff=True,
        )
        user.last_login = timezone.now()
        user.save(update_fields=["last_login", "updated_at"])
        return build_auth_response(user)


class CookieTokenRefreshView(TokenRefreshView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, *args, **kwargs):
        mutable_data = request.data.copy()
        if not mutable_data.get("refresh"):
            cookie_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
            if cookie_token:
                mutable_data["refresh"] = cookie_token
        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        new_refresh = serializer.validated_data.get("refresh")
        if new_refresh:
            response.set_cookie(
                key=settings.REFRESH_COOKIE_NAME,
                value=new_refresh,
                httponly=True,
                secure=settings.REFRESH_COOKIE_SECURE,
                samesite=settings.REFRESH_COOKIE_SAMESITE,
                max_age=60 * 60 * 24 * 30,
            )
        return response


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        settings_obj = SiteSettings.load()
        payload = {
            "user": MeSerializer(request.user).data,
            "payment_settings": {
                "bank_requisites": settings_obj.bank_requisites,
                "crypto_requisites": settings_obj.crypto_requisites,
                "instructions": settings_obj.instructions,
                "payment_methods": ["crypto", "bank_transfer"],
            },
        }
        return Response(payload, status=status.HTTP_200_OK)


class MeProfileUpdateView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(instance=request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user
        update_fields = ["updated_at"]

        if "username" in data:
            user.username = data["username"]
            update_fields.append("username")
        if data.get("remove_profile_photo"):
            user.profile_photo = None
            update_fields.append("profile_photo")
        elif "profile_photo" in data:
            user.profile_photo = data.get("profile_photo")
            update_fields.append("profile_photo")

        user.save(update_fields=sorted(set(update_fields)))

        return Response(
            {"user": MeSerializer(user, context={"request": request}).data},
            status=status.HTTP_200_OK,
        )


class ClientProfileDetailView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request, user_id: int):
        if not (
            request.user.is_superuser
            or request.user.role == RoleChoices.ADMIN
            or request.user.role == RoleChoices.MASTER
        ):
            return Response({"detail": "Недостаточно прав"}, status=status.HTTP_403_FORBIDDEN)

        client_user = get_object_or_404(
            User.objects.select_related("client_stats"),
            id=user_id,
            role=RoleChoices.CLIENT,
        )
        serializer = ClientProfileDetailSerializer(client_user, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


def serialize_wholesale_status(user: User, request=None) -> dict:
    def file_url(file_field):
        if not file_field or not getattr(file_field, "url", None):
            return None
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    return WholesaleStatusSerializer(
        {
            "is_service_center": user.is_service_center,
            "wholesale_status": user.wholesale_status,
            "wholesale_company_name": user.wholesale_company_name,
            "wholesale_city": user.wholesale_city,
            "wholesale_address": user.wholesale_address,
            "wholesale_comment": user.wholesale_comment,
            "wholesale_service_details": user.wholesale_service_details,
            "wholesale_service_photo_1_url": file_url(user.wholesale_service_photo_1),
            "wholesale_service_photo_2_url": file_url(user.wholesale_service_photo_2),
            "wholesale_requested_at": user.wholesale_requested_at,
            "wholesale_reviewed_at": user.wholesale_reviewed_at,
            "wholesale_review_comment": user.wholesale_review_comment,
        }
    ).data


class WholesaleStatusView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только для клиентов"}, status=status.HTTP_403_FORBIDDEN)
        return Response(serialize_wholesale_status(request.user, request=request), status=status.HTTP_200_OK)


class WholesaleRequestView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def post(self, request):
        if request.user.role != RoleChoices.CLIENT:
            return Response({"detail": "Только клиент может отправить оптовую заявку"}, status=status.HTTP_403_FORBIDDEN)

        serializer = WholesaleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        user = request.user
        previous_status = user.wholesale_status
        is_service_center = bool(payload.get("is_service_center", True))
        service_name = (payload.get("wholesale_company_name") or "").strip()
        service_city = (payload.get("wholesale_city") or "").strip()
        service_address = (payload.get("wholesale_address") or "").strip()
        comment = (payload.get("wholesale_comment") or "").strip()
        service_details = (payload.get("wholesale_service_details") or "").strip()
        service_photo_1 = payload.get("wholesale_service_photo_1")
        service_photo_2 = payload.get("wholesale_service_photo_2")
        effective_photo_1 = service_photo_1 if service_photo_1 is not None else user.wholesale_service_photo_1
        effective_photo_2 = service_photo_2 if service_photo_2 is not None else user.wholesale_service_photo_2

        update_fields = ["updated_at"]
        user.is_service_center = is_service_center
        user.wholesale_company_name = service_name
        user.wholesale_city = service_city
        user.wholesale_address = service_address
        user.wholesale_comment = comment
        user.wholesale_service_details = service_details
        update_fields.extend(
            [
                "is_service_center",
                "wholesale_company_name",
                "wholesale_city",
                "wholesale_address",
                "wholesale_comment",
                "wholesale_service_details",
            ]
        )

        if is_service_center:
            if len(service_details) < 20:
                return Response(
                    {"detail": "Добавьте подробное описание сервиса (минимум 20 символов)"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not effective_photo_1 and not effective_photo_2:
                return Response(
                    {"detail": "Добавьте хотя бы одно фото сервиса"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if service_photo_1 is not None:
            user.wholesale_service_photo_1 = service_photo_1
            update_fields.append("wholesale_service_photo_1")
        if service_photo_2 is not None:
            user.wholesale_service_photo_2 = service_photo_2
            update_fields.append("wholesale_service_photo_2")

        if not is_service_center:
            user.wholesale_status = WholesaleStatusChoices.NONE
            user.wholesale_discount_percent = 0
            user.wholesale_requested_at = None
            user.wholesale_reviewed_at = None
            user.wholesale_review_comment = ""
            user.wholesale_city = ""
            user.wholesale_address = ""
            user.wholesale_service_details = ""
            user.wholesale_service_photo_1 = None
            user.wholesale_service_photo_2 = None
            update_fields.extend(
                [
                    "wholesale_status",
                    "wholesale_discount_percent",
                    "wholesale_requested_at",
                    "wholesale_reviewed_at",
                    "wholesale_review_comment",
                    "wholesale_city",
                    "wholesale_address",
                    "wholesale_service_details",
                    "wholesale_service_photo_1",
                    "wholesale_service_photo_2",
                ]
            )
        else:
            if user.wholesale_status != WholesaleStatusChoices.APPROVED:
                user.wholesale_status = WholesaleStatusChoices.PENDING
                user.wholesale_requested_at = timezone.now()
                user.wholesale_reviewed_at = None
                user.wholesale_review_comment = ""
                update_fields.extend(
                    [
                        "wholesale_status",
                        "wholesale_requested_at",
                        "wholesale_reviewed_at",
                        "wholesale_review_comment",
                    ]
                )

        user.save(update_fields=sorted(set(update_fields)))

        if is_service_center and user.wholesale_status == WholesaleStatusChoices.PENDING and previous_status != WholesaleStatusChoices.PENDING:
            emit_event(
                "wholesale.requested",
                user,
                actor=user,
                payload={
                    "company": service_name,
                    "city": service_city,
                    "address": service_address,
                    "comment": comment,
                    "has_photo_1": bool(user.wholesale_service_photo_1),
                    "has_photo_2": bool(user.wholesale_service_photo_2),
                },
            )
            admins = User.objects.filter(Q(role=RoleChoices.ADMIN) | Q(is_superuser=True)).distinct()
            for admin in admins:
                create_notification(
                    user=admin,
                    type="system",
                    title="Новая оптовая заявка",
                    message=f"Клиент @{user.username} запросил оптовый статус",
                    payload={"client_id": user.id},
                )

        return Response(serialize_wholesale_status(user, request=request), status=status.HTTP_200_OK)


def calculate_unread_total(appointments_queryset, user: User) -> int:
    appointment_ids = list(appointments_queryset.values_list("id", flat=True))
    if not appointment_ids:
        return 0

    states = ReadState.objects.filter(user=user, appointment_id__in=appointment_ids).values("appointment_id", "last_read_message_id")
    last_read_map = {row["appointment_id"]: row["last_read_message_id"] for row in states}

    unread_total = 0
    for appointment in appointments_queryset:
        last_read_id = last_read_map.get(appointment.id, 0)
        unread_total += appointment.messages.filter(id__gt=last_read_id, is_deleted=False).exclude(sender=user).count()
    return unread_total


class DashboardSummaryView(APIView):
    permission_classes = (IsAuthenticatedAndNotBanned,)

    def get(self, request):
        user = request.user
        active_statuses = (
            AppointmentStatusChoices.NEW,
            AppointmentStatusChoices.IN_REVIEW,
            AppointmentStatusChoices.AWAITING_PAYMENT,
            AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED,
            AppointmentStatusChoices.PAID,
            AppointmentStatusChoices.IN_PROGRESS,
        )

        if user.role == RoleChoices.CLIENT:
            queryset = Appointment.objects.filter(client=user)
            payload = {
                "role": user.role,
                "counts": {
                    "appointments_total": queryset.count(),
                    "appointments_active": queryset.filter(status__in=active_statuses).count(),
                    "awaiting_payment": queryset.filter(status=AppointmentStatusChoices.AWAITING_PAYMENT).count(),
                    "completed": queryset.filter(status=AppointmentStatusChoices.COMPLETED).count(),
                    "declined": queryset.filter(status=AppointmentStatusChoices.DECLINED_BY_MASTER).count(),
                    "unread_total": calculate_unread_total(queryset, user),
                },
            }
            return Response(payload, status=status.HTTP_200_OK)

        if user.role == RoleChoices.MASTER:
            master_stats = recalculate_master_stats(user)
            can_take_new = user.is_master_active
            new_available_queryset = Appointment.objects.filter(
                status=AppointmentStatusChoices.NEW,
                assigned_master__isnull=True,
            ) if can_take_new else Appointment.objects.none()
            own_queryset = Appointment.objects.filter(assigned_master=user)
            own_active_queryset = own_queryset.filter(status__in=active_statuses)
            payload = {
                "role": user.role,
                "counts": {
                    "new_available": new_available_queryset.count(),
                    "active_total": own_active_queryset.count(),
                    "awaiting_client_payment": own_queryset.filter(status=AppointmentStatusChoices.AWAITING_PAYMENT).count(),
                    "awaiting_payment_confirmation": own_queryset.filter(status=AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED).count(),
                    "in_progress": own_queryset.filter(status=AppointmentStatusChoices.IN_PROGRESS).count(),
                    "completed_total": own_queryset.filter(status=AppointmentStatusChoices.COMPLETED).count(),
                    "unread_total": calculate_unread_total(own_active_queryset, user),
                    "master_score": master_stats.master_score,
                },
            }
            return Response(payload, status=status.HTTP_200_OK)

        is_admin = user.role == RoleChoices.ADMIN or user.is_superuser
        if is_admin:
            admin_accounts_count = User.objects.filter(role=RoleChoices.ADMIN).count() + User.objects.filter(is_superuser=True).exclude(role=RoleChoices.ADMIN).count()
            appointments_queryset = Appointment.objects.all()
            payload = {
                "role": "admin",
                "counts": {
                    "users_total": User.objects.count(),
                    "clients_total": User.objects.filter(role=RoleChoices.CLIENT).count(),
                    "masters_total": User.objects.filter(role=RoleChoices.MASTER).count(),
                    "admins_total": admin_accounts_count,
                    "appointments_total": appointments_queryset.count(),
                    "appointments_new": appointments_queryset.filter(status=AppointmentStatusChoices.NEW).count(),
                    "appointments_active": appointments_queryset.filter(status__in=active_statuses).count(),
                    "payments_waiting_confirmation": appointments_queryset.filter(status=AppointmentStatusChoices.PAYMENT_PROOF_UPLOADED).count(),
                    "appointments_completed": appointments_queryset.filter(status=AppointmentStatusChoices.COMPLETED).count(),
                },
            }
            return Response(payload, status=status.HTTP_200_OK)

        # Defensive fallback for unknown role values.
        return Response({"role": user.role, "counts": {}}, status=status.HTTP_200_OK)


