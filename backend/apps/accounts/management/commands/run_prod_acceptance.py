from __future__ import annotations

import json
import secrets
import time

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import RoleChoices, User
from apps.appointments.models import Appointment
from apps.common.prod_acceptance import run_acceptance
from apps.platform.models import PlatformEvent


class Command(BaseCommand):
    help = "Run a live production acceptance smoke with an auto-provisioned temporary client."

    def add_arguments(self, parser):
        parser.add_argument("--base-url", default="https://frpclient.ru", help="Public deployment URL.")
        parser.add_argument(
            "--username-prefix",
            default="smoke_client",
            help="Prefix for the temporary client username.",
        )
        parser.add_argument(
            "--keep-artifacts",
            action="store_true",
            help="Keep the temporary user and related records for debugging instead of cleaning them up.",
        )

    def handle(self, *args, **options):
        base_url = options["base_url"]
        username_prefix = options["username_prefix"]
        keep_artifacts = bool(options["keep_artifacts"])

        user, password = self._create_temp_client(username_prefix)
        acceptance_result: dict[str, object] | None = None
        cleanup_summary: dict[str, object] | None = None

        try:
            acceptance_result = run_acceptance(base_url=base_url, username=user.username, password=password)
        except Exception as exc:
            if keep_artifacts:
                raise CommandError(
                    f"acceptance failed; artifacts kept for debugging: user_id={user.id} username={user.username} "
                    f"error={exc}"
                ) from exc

            cleanup_summary = self._cleanup_artifacts(user_id=user.id)
            raise CommandError(f"acceptance failed and artifacts were cleaned: {exc}") from exc

        if keep_artifacts:
            acceptance_result.update(
                {
                    "user_id": user.id,
                    "password": password,
                    "cleanup": "skipped",
                }
            )
        else:
            cleanup_summary = self._cleanup_artifacts(user_id=user.id)
            acceptance_result.update(
                {
                    "user_id": user.id,
                    "cleanup": cleanup_summary,
                }
            )

        self.stdout.write(json.dumps(acceptance_result, ensure_ascii=False))

    def _create_temp_client(self, username_prefix: str) -> tuple[User, str]:
        suffix = f"{int(time.time())}_{secrets.token_hex(3)}"
        username = f"{username_prefix}_{suffix}"[:150]
        password = secrets.token_urlsafe(18)
        now = timezone.now()
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.invalid",
            password=password,
            role=RoleChoices.CLIENT,
            is_active=True,
            is_email_verified=True,
            email_verified_at=now,
        )
        return user, password

    def _cleanup_artifacts(self, *, user_id: int) -> dict[str, object]:
        appointment_ids = list(Appointment.objects.filter(client_id=user_id).values_list("id", flat=True))

        platform_events_filter = Q(actor_id=user_id) | Q(entity_type="User", entity_id=str(user_id))
        if appointment_ids:
            platform_events_filter |= Q(entity_type="Appointment", entity_id__in=[str(appointment_id) for appointment_id in appointment_ids])

        deleted_platform_events, _deleted_details = PlatformEvent.objects.filter(platform_events_filter).delete()

        deleted_users, _deleted_user_details = User.objects.filter(id=user_id).delete()

        return {
            "appointments_deleted": len(appointment_ids),
            "appointment_ids": appointment_ids,
            "platform_events_deleted": deleted_platform_events,
            "users_deleted": deleted_users,
        }
