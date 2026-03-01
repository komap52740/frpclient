from rest_framework.permissions import BasePermission
from rest_framework.permissions import IsAuthenticated

from .models import RoleChoices


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.role == RoleChoices.ADMIN or user.is_superuser))


class IsMasterRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == RoleChoices.MASTER)


class IsClientRole(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == RoleChoices.CLIENT)


class IsAuthenticatedAndNotBanned(IsAuthenticated):
    message = "Ваш аккаунт заблокирован администратором."

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        user = request.user
        if user.role == RoleChoices.CLIENT and user.is_banned:
            reason = (user.ban_reason or "").strip()
            if reason:
                self.message = f"Ваш аккаунт заблокирован администратором. Причина: {reason}"
            return False
        return True
