from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from django.conf import settings


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "ops" / "backup" / "prune_backup_artifacts.py"


def write_file(path: Path, content: str = "x") -> None:
    path.write_text(content, encoding="utf-8")


def set_age_in_days(path: Path, days: int) -> None:
    timestamp = time.time() - days * 86400
    os.utime(path, (timestamp, timestamp))


def run_prune(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT_PATH), *args],
        capture_output=True,
        text=True,
        check=True,
    )


def test_prune_backup_artifacts_keeps_latest_target_and_keep_count():
    temp_root = Path(settings.BASE_DIR).parent / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        backup_dir = Path(temp_dir) / "postgres"
        backup_dir.mkdir()

        newest = backup_dir / "frpclient-postgres-20260312T030000Z.sql.gz"
        mid = backup_dir / "frpclient-postgres-20260312T020000Z.sql.gz"
        old = backup_dir / "frpclient-postgres-20260312T010000Z.sql.gz"
        latest_target = backup_dir / "frpclient-postgres-20260301T010000Z.sql.gz"
        ignored = backup_dir / "notes.txt"

        for path in (newest, mid, old, latest_target):
            write_file(path)
        write_file(ignored, "ignore")

        result = run_prune(
            str(backup_dir),
            "--pattern",
            "frpclient-postgres-*.sql.gz",
            "--latest-link",
            str(latest_target),
            "--keep-count",
            "2",
            "--retention-days",
            "14",
        )

        assert newest.exists()
        assert mid.exists()
        assert latest_target.exists()
        assert not old.exists()
        assert ignored.exists()
        assert "deleted: " in result.stdout


def test_prune_backup_artifacts_removes_old_files_by_age():
    temp_root = Path(settings.BASE_DIR).parent / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        backup_dir = Path(temp_dir) / "media"
        backup_dir.mkdir()

        recent = backup_dir / "frpclient-media-20260312T030000Z.tar.gz"
        stale = backup_dir / "frpclient-media-20260301T030000Z.tar.gz"
        for path in (recent, stale):
            write_file(path)

        set_age_in_days(recent, 1)
        set_age_in_days(stale, 30)

        run_prune(
            str(backup_dir),
            "--pattern",
            "frpclient-media-*.tar.gz",
            "--keep-count",
            "5",
            "--retention-days",
            "14",
        )

        assert recent.exists()
        assert not stale.exists()
