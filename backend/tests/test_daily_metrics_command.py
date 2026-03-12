from __future__ import annotations

from io import StringIO
from types import SimpleNamespace
import datetime as dt

from django.core.management import call_command


def test_compute_daily_metrics_command_uses_localdate_by_default(monkeypatch):
    target_date = dt.date(2026, 3, 12)
    called = []

    def fake_compute_daily_metrics_for_date(value):
        called.append(value)
        return SimpleNamespace(date=value)

    monkeypatch.setattr(
        "apps.platform.management.commands.compute_daily_metrics.compute_daily_metrics_for_date",
        fake_compute_daily_metrics_for_date,
    )
    monkeypatch.setattr(
        "apps.platform.management.commands.compute_daily_metrics.timezone.localdate",
        lambda: target_date,
    )

    stdout = StringIO()
    call_command("compute_daily_metrics", stdout=stdout)

    assert called == [target_date]
    assert f"Computed daily metrics for {target_date}" in stdout.getvalue()
