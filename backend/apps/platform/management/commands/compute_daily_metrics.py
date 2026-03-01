from __future__ import annotations

from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from apps.platform.analytics import compute_daily_metrics_for_date


class Command(BaseCommand):
    help = "Вычисляет ежедневные метрики платформы за день или диапазон."

    def add_arguments(self, parser):
        parser.add_argument("--date", type=str, help="Дата в формате YYYY-MM-DD")
        parser.add_argument("--from", dest="date_from", type=str, help="Начальная дата YYYY-MM-DD")
        parser.add_argument("--to", dest="date_to", type=str, help="Конечная дата YYYY-MM-DD")

    def handle(self, *args, **options):
        single_date_raw = options.get("date")
        date_from_raw = options.get("date_from")
        date_to_raw = options.get("date_to")

        if single_date_raw and (date_from_raw or date_to_raw):
            raise CommandError("Используйте либо --date, либо диапазон --from/--to")

        if single_date_raw:
            target_date = date.fromisoformat(single_date_raw)
            metrics = compute_daily_metrics_for_date(target_date)
            self.stdout.write(self.style.SUCCESS(f"Computed daily metrics for {metrics.date}"))
            return

        if not date_from_raw and not date_to_raw:
            today = date.today()
            metrics = compute_daily_metrics_for_date(today)
            self.stdout.write(self.style.SUCCESS(f"Computed daily metrics for {metrics.date}"))
            return

        if not date_from_raw or not date_to_raw:
            raise CommandError("Для диапазона укажите одновременно --from и --to")

        date_from = date.fromisoformat(date_from_raw)
        date_to = date.fromisoformat(date_to_raw)
        if date_to < date_from:
            raise CommandError("--to не может быть раньше --from")

        total = 0
        cursor = date_from
        while cursor <= date_to:
            compute_daily_metrics_for_date(cursor)
            total += 1
            cursor += timedelta(days=1)
        self.stdout.write(self.style.SUCCESS(f"Computed daily metrics for {total} days"))
