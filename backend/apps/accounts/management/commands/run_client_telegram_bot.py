from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.telegram_bot import ClientTelegramBot


class Command(BaseCommand):
    help = "Запускает Telegram-бота клиентского кабинета (polling)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--frontend-url",
            type=str,
            default=settings.TELEGRAM_CLIENT_BOT_FRONTEND_URL,
            help="Публичный URL фронтенда для ссылок (например https://client.androidmultitool.ru).",
        )
        parser.add_argument(
            "--keep-pending",
            action="store_true",
            help="Не сбрасывать накопленные апдейты Telegram при старте.",
        )

    def handle(self, *args, **options):
        token = settings.TELEGRAM_BOT_TOKEN
        if not token:
            raise CommandError("TELEGRAM_BOT_TOKEN не задан в backend/.env")

        frontend_url = options.get("frontend_url") or ""
        keep_pending = bool(options.get("keep_pending"))

        self.stdout.write(self.style.SUCCESS("Client Telegram bot started"))
        bot = ClientTelegramBot(token=token, frontend_url=frontend_url)
        bot.run_forever(drop_pending_updates=not keep_pending)

