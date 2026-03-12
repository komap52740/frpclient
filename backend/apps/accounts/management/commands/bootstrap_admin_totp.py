from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils.crypto import get_random_string
from django_otp.plugins.otp_static.models import StaticDevice, StaticToken
from django_otp.plugins.otp_totp.models import TOTPDevice


User = get_user_model()


class Command(BaseCommand):
    help = "Создаёт или перевыпускает TOTP-устройство для staff/admin и печатает provisioning URI."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Логин администратора.")
        parser.add_argument("--device-name", default="default", help="Имя TOTP-устройства.")
        parser.add_argument(
            "--rotate",
            action="store_true",
            help="Удалить старое устройство с тем же именем и создать новое.",
        )
        parser.add_argument(
            "--issue-static-token",
            action="store_true",
            help="Создать одноразовый аварийный static token и вывести его в stdout.",
        )

    def handle(self, *args, **options):
        username = (options["username"] or "").strip()
        device_name = (options["device_name"] or "default").strip() or "default"
        rotate = bool(options["rotate"])
        issue_static_token = bool(options["issue_static_token"])

        user = User.objects.filter(username=username, is_active=True).first()
        if user is None:
            raise CommandError(f"Активный пользователь не найден: {username}")
        if not (user.is_staff or getattr(user, "role", "") == "admin" or user.is_superuser):
            raise CommandError(f"Пользователь {username} не является staff/admin")

        if rotate:
            TOTPDevice.objects.filter(user=user, name=device_name).delete()

        device, created = TOTPDevice.objects.get_or_create(
            user=user,
            name=device_name,
            defaults={"confirmed": True},
        )
        if not created and not device.confirmed:
            device.confirmed = True
            device.save(update_fields=["confirmed"])

        self.stdout.write(self.style.SUCCESS("TOTP устройство готово."))
        self.stdout.write(f"username={user.username}")
        self.stdout.write(f"device_name={device.name}")
        self.stdout.write(f"config_url={device.config_url}")

        if issue_static_token:
            static_device, _ = StaticDevice.objects.get_or_create(user=user, name=f"{device_name}-emergency")
            static_token = get_random_string(16)
            StaticToken.objects.create(device=static_device, token=static_token)
            self.stdout.write(self.style.WARNING(f"emergency_static_token={static_token}"))
