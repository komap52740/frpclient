from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import EmailVerificationToken, RoleChoices, SiteSettings, User
from apps.appointments.models import Appointment
from apps.platform.models import DailyMetrics, Notification, PlatformEvent


class Command(BaseCommand):
    help = "Полная очистка данных: оставить только одного администратора и удалить все заявки."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="komap", help="Логин администратора, которого нужно оставить.")
        parser.add_argument("--password", required=True, help="Новый пароль администратора.")
        parser.add_argument("--email", default="", help="Email администратора (опционально).")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Подтверждение опасной операции.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if not options["force"]:
            raise CommandError("Добавьте --force для подтверждения полной очистки.")

        username = (options["username"] or "").strip()
        password = options["password"]
        email = (options["email"] or "").strip()
        if not username:
            raise CommandError("Логин администратора не может быть пустым.")

        appointments_before = Appointment.objects.count()
        users_before = User.objects.count()
        notifications_before = Notification.objects.count()
        events_before = PlatformEvent.objects.count()
        metrics_before = DailyMetrics.objects.count()
        verification_tokens_before = EmailVerificationToken.objects.count()

        admin_user = User.objects.filter(username=username).first()
        if admin_user is None:
            admin_user = User.objects.create(
                username=username,
                role=RoleChoices.ADMIN,
                is_staff=True,
                is_superuser=True,
                is_active=True,
                email=email,
            )
        else:
            admin_user.role = RoleChoices.ADMIN
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.is_active = True
            admin_user.is_banned = False
            admin_user.ban_reason = ""
            admin_user.banned_at = None
            if email:
                admin_user.email = email
            admin_user.save(
                update_fields=[
                    "role",
                    "is_staff",
                    "is_superuser",
                    "is_active",
                    "is_banned",
                    "ban_reason",
                    "banned_at",
                    "email",
                    "updated_at",
                ]
            )

        admin_user.set_password(password)
        admin_user.save(update_fields=["password"])

        Appointment.objects.all().delete()
        Notification.objects.all().delete()
        PlatformEvent.objects.all().delete()
        DailyMetrics.objects.all().delete()
        EmailVerificationToken.objects.all().delete()

        User.objects.exclude(id=admin_user.id).delete()

        # Если пользователь ранее был клиентом/мастером, удаляем связанные расчетные профили.
        try:
            admin_user.client_stats.delete()
        except User.client_stats.RelatedObjectDoesNotExist:
            pass
        try:
            admin_user.master_stats.delete()
        except User.master_stats.RelatedObjectDoesNotExist:
            pass

        SiteSettings.load()

        self.stdout.write(self.style.SUCCESS("Очистка завершена успешно."))
        self.stdout.write(f"Оставлен администратор: {admin_user.username} (id={admin_user.id})")
        self.stdout.write(
            "Удалено: "
            f"заявок={appointments_before}, "
            f"пользователей={max(users_before - 1, 0)}, "
            f"уведомлений={notifications_before}, "
            f"событий={events_before}, "
            f"метрик={metrics_before}, "
            f"email-токенов={verification_tokens_before}"
        )
