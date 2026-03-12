#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path


def parse_env_file(path: Path, *, allow_missing: bool = False) -> dict[str, str]:
    if not path.is_file():
        if allow_missing:
            return {}
        raise FileNotFoundError(f"env file not found: {path}")

    data: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        data[key] = value
    return data


def load_env_chain(paths: list[Path], *, allow_missing: bool = False) -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in paths:
        merged.update(parse_env_file(path, allow_missing=allow_missing))
    return merged


def emit_shell_exports(data: dict[str, str]) -> None:
    for key in sorted(data):
        sys.stdout.write(f"export {key}={shlex.quote(data[key])}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", action="append", default=[], help="Env file path. Later files override earlier ones.")
    parser.add_argument("--allow-missing", action="store_true", help="Ignore missing env files.")
    parser.add_argument("--key", default="", help="Print only one value from merged env chain.")
    parser.add_argument("--format", choices=("json", "shell"), default="json")
    args = parser.parse_args()

    try:
        merged = load_env_chain([Path(item) for item in args.file], allow_missing=args.allow_missing)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.key:
        sys.stdout.write(str(merged.get(args.key, "")))
        if merged.get(args.key, ""):
            sys.stdout.write("\n")
        return 0

    if args.format == "shell":
        emit_shell_exports(merged)
    else:
        json.dump(merged, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
