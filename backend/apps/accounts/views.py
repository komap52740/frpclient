from __future__ import annotations

from django.conf import settings
from django.utils import timezone
from django.utils.crypto import get_random_string
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import RoleChoices, SiteSettings, User
from .serializers import MeSerializer, TelegramAuthSerializer


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
            user.save(update_fields=[
                "telegram_username",
                "telegram_photo_url",
                "first_name",
                "last_name",
                "last_login",
                "updated_at",
            ])

        refresh = RefreshToken.for_user(user)
        payload = {
            "access": str(refresh.access_token),
            "user": MeSerializer(user).data,
        }
        response = Response(payload)
        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(refresh),
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            max_age=int(refresh.lifetime.total_seconds()),
        )
        return response


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


