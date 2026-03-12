from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def run_step(*, name: str, command: list[str], cwd: Path) -> None:
    print(f"\n==> {name}")
    print(" ".join(command))
    result = subprocess.run(command, cwd=cwd)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def npm_command() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the 1.0 release gate checks.")
    parser.add_argument("--backend-only", action="store_true", help="Run only backend checks.")
    parser.add_argument("--frontend-only", action="store_true", help="Run only frontend checks.")
    args = parser.parse_args()

    if args.backend_only and args.frontend_only:
        parser.error("--backend-only and --frontend-only cannot be used together")

    if not args.frontend_only:
        run_step(
            name="Backend tests",
            command=[sys.executable, "-m", "pytest", "tests"],
            cwd=ROOT / "backend",
        )

    if not args.backend_only:
        run_step(
            name="Frontend production build",
            command=[npm_command(), "run", "build"],
            cwd=ROOT / "frontend",
        )

    print("\nRelease gate passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
