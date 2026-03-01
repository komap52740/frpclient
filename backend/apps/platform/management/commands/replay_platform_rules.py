from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.platform.models import PlatformEvent
from apps.platform.rules import process_event_rules


class Command(BaseCommand):
    help = "Повторно прогоняет rule engine по последним N platform events."

    def add_arguments(self, parser):
        parser.add_argument("--last", type=int, default=200, help="Сколько последних событий обработать")

    def handle(self, *args, **options):
        last = max(int(options["last"]), 1)
        events = list(PlatformEvent.objects.order_by("-id")[:last])
        events.reverse()

        processed = 0
        actions_executed = 0
        for event in events:
            actions_executed += process_event_rules(event)
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed events: {processed}, executed actions: {actions_executed}"
            )
        )
