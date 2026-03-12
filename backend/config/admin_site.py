from __future__ import annotations

from django_otp.admin import OTPAdminSite


class FRPAdminSite(OTPAdminSite):
    site_header = "Панель администрирования FRP"
    site_title = "Администрирование FRP"
    index_title = "Управление системой"
    enable_nav_sidebar = True


def build_admin_site():
    return FRPAdminSite(OTPAdminSite.name)
