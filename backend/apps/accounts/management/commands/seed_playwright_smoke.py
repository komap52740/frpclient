from __future__ import annotations

import json

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import (
    RoleChoices,
    User,
    WholesalePriorityChoices,
    WholesaleStatusChoices,
)
from apps.appointments.models import Appointment


class Command(BaseCommand):
    help = "Seed a deterministic approved B2B client for Playwright smoke tests."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="playwright_b2b_client")
        parser.add_argument("--password", default="PlaywrightPass123!")
        parser.add_argument("--email", default="playwright-b2b@example.invalid")
        parser.add_argument("--admin-username", default="playwright_admin")
        parser.add_argument("--admin-password", default="PlaywrightAdmin123!")
        parser.add_argument("--admin-email", default="playwright-admin@example.invalid")
        parser.add_argument(
            "--reset-appointments",
            action="store_true",
            help="Delete existing appointments for the seeded user before the smoke run.",
        )

    def handle(self, *args, **options):
        username = (options["username"] or "").strip()
        password = options["password"] or "PlaywrightPass123!"
        email = (options["email"] or "").strip() or f"{username}@example.invalid"
        admin_username = (options["admin_username"] or "").strip() or "playwright_admin"
        admin_password = options["admin_password"] or "PlaywrightAdmin123!"
        admin_email = (options["admin_email"] or "").strip() or f"{admin_username}@example.invalid"
        reset_appointments = bool(options["reset_appointments"])
        now = timezone.now()

        admin_user, admin_created = User.objects.get_or_create(
            username=admin_username,
            defaults={
                "email": admin_email,
                "role": RoleChoices.ADMIN,
                "is_active": True,
                "is_staff": True,
                "is_email_verified": True,
                "email_verified_at": now,
            },
        )
        admin_user.email = admin_email
        admin_user.role = RoleChoices.ADMIN
        admin_user.is_active = True
        admin_user.is_staff = True
        admin_user.is_superuser = False
        admin_user.is_banned = False
        admin_user.ban_reason = ""
        admin_user.is_email_verified = True
        admin_user.email_verified_at = admin_user.email_verified_at or now
        admin_user.set_password(admin_password)
        admin_user.save()

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": RoleChoices.CLIENT,
                "is_active": True,
                "is_email_verified": True,
                "email_verified_at": now,
            },
        )

        user.email = email
        user.role = RoleChoices.CLIENT
        user.is_active = True
        user.is_banned = False
        user.ban_reason = ""
        user.is_email_verified = True
        user.email_verified_at = user.email_verified_at or now
        user.is_service_center = True
        user.wholesale_status = WholesaleStatusChoices.APPROVED
        user.wholesale_priority = WholesalePriorityChoices.PRIORITY
        user.wholesale_company_name = "Playwright Service Center"
        user.wholesale_city = "Moscow"
        user.wholesale_address = "Test line 12"
        user.wholesale_comment = "Autoprovisioned for browser smoke tests"
        user.wholesale_service_details = "Deterministic B2B smoke profile"
        user.wholesale_requested_at = user.wholesale_requested_at or now
        user.wholesale_reviewed_at = user.wholesale_reviewed_at or now
        user.wholesale_verified_at = user.wholesale_verified_at or now
        user.wholesale_review_comment = "Auto-approved for Playwright smoke"
        user.set_password(password)
        user.save()

        deleted_appointments = 0
        if reset_appointments:
            deleted_appointments, _ = Appointment.objects.filter(client=user).delete()

        payload = {
            "created": created,
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "admin_created": admin_created,
            "admin_user_id": admin_user.id,
            "admin_username": admin_user.username,
            "reset_appointments": reset_appointments,
            "deleted_appointments": deleted_appointments,
            "wholesale_status": user.wholesale_status,
            "wholesale_priority": user.wholesale_priority,
        }
        self.stdout.write(json.dumps(payload, ensure_ascii=False))
