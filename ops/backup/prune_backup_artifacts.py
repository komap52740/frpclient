from __future__ import annotations

import argparse
import fnmatch
import os
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prune backup artifacts by count and retention age.")
    parser.add_argument("backup_dir")
    parser.add_argument("--pattern", required=True, help="Filename glob inside backup_dir")
    parser.add_argument("--latest-link", default="", help="Path to latest backup symlink or file")
    parser.add_argument("--keep-count", type=int, default=10)
    parser.add_argument("--retention-days", type=int, default=14)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def iter_backup_files(backup_dir: Path, pattern: str) -> list[Path]:
    return sorted(
        (
            path
            for path in backup_dir.iterdir()
            if path.is_file() and not path.is_symlink() and fnmatch.fnmatch(path.name, pattern)
        ),
        key=lambda path: path.name,
        reverse=True,
    )


def resolve_latest_target(latest_link: Path | None) -> Path | None:
    if latest_link is None or not latest_link.exists():
        return None
    try:
        return latest_link.resolve(strict=True)
    except OSError:
        return None


def prune_backups(
    *,
    backup_dir: Path,
    pattern: str,
    latest_link: Path | None,
    keep_count: int,
    retention_days: int,
    dry_run: bool,
) -> tuple[list[Path], list[Path]]:
    files = iter_backup_files(backup_dir, pattern)
    latest_target = resolve_latest_target(latest_link)
    max_age_seconds = max(0, retention_days) * 86400
    current_time = int(time.time())

    retained: list[Path] = []
    deleted: list[Path] = []

    for index, path in enumerate(files, start=1):
        should_keep = index <= max(1, keep_count)
        if latest_target is not None and path == latest_target:
            should_keep = True

        age_seconds = max(0, current_time - int(path.stat().st_mtime))
        if max_age_seconds and age_seconds > max_age_seconds and path != latest_target:
            should_keep = False

        if should_keep:
            retained.append(path)
            continue

        deleted.append(path)
        if not dry_run:
            path.unlink()

    return retained, deleted


def main() -> int:
    args = parse_args()
    backup_dir = Path(args.backup_dir)
    if not backup_dir.exists():
        print(f"backup dir missing, nothing to prune: {backup_dir}")
        return 0

    latest_link = Path(args.latest_link) if args.latest_link else None
    retained, deleted = prune_backups(
        backup_dir=backup_dir,
        pattern=args.pattern,
        latest_link=latest_link,
        keep_count=max(1, args.keep_count),
        retention_days=max(0, args.retention_days),
        dry_run=args.dry_run,
    )

    latest_target = resolve_latest_target(latest_link)
    latest_display = str(latest_target) if latest_target is not None else "-"
    print(
        "backup prune completed:",
        f"dir={backup_dir}",
        f"pattern={args.pattern}",
        f"retained={len(retained)}",
        f"deleted={len(deleted)}",
        f"latest={latest_display}",
        "dry_run=1" if args.dry_run else "dry_run=0",
    )
    for path in deleted:
        print(f"deleted: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
