#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


INCLUDE_PATHS = (
    ".env.example",
    "README.md",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "docker-compose.prod.bot.yml",
    "backend/.env.example",
    "frontend/.env.example",
    "backend",
    "frontend",
    "ops",
    "scripts",
)
SKIP_DIR_NAMES = {
    ".deploy",
    ".git",
    ".github",
    ".idea",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "venv",
}
SKIP_FILE_NAMES = {
    "deploy-sync.tar",
}
SKIP_SUFFIXES = {
    ".pyc",
    ".pyo",
}


def run_text(args: list[str], cwd: Path | None = None) -> str:
    try:
        return subprocess.check_output(args, cwd=cwd, stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ""


def is_git_worktree(project_dir: Path) -> bool:
    return run_text(["git", "rev-parse", "--is-inside-work-tree"], cwd=project_dir) == "true"


def resolve_git_tag(project_dir: Path) -> str:
    return run_text(["git", "describe", "--tags", "--exact-match", "HEAD"], cwd=project_dir)


def git_status_porcelain(project_dir: Path) -> str:
    return run_text(["git", "status", "--porcelain", "--untracked-files=normal"], cwd=project_dir)


def should_skip_file(project_dir: Path, path: Path) -> bool:
    if path.is_symlink() or not path.is_file():
        return True

    relative_parts = path.relative_to(project_dir).parts
    if any(part in SKIP_DIR_NAMES for part in relative_parts[:-1]):
        return True

    name = path.name
    if name in SKIP_FILE_NAMES:
        return True
    if path.suffix in SKIP_SUFFIXES:
        return True
    if name.startswith(".env") and name != ".env.example":
        return True
    return False


def iter_source_files(project_dir: Path) -> list[Path]:
    collected: dict[str, Path] = {}
    for relative_path in INCLUDE_PATHS:
        candidate = project_dir / relative_path
        if not candidate.exists():
            continue

        if candidate.is_file():
            if not should_skip_file(project_dir, candidate):
                collected[candidate.relative_to(project_dir).as_posix()] = candidate
            continue

        for root, dir_names, file_names in os.walk(candidate):
            dir_names[:] = sorted(name for name in dir_names if name not in SKIP_DIR_NAMES)
            for file_name in sorted(file_names):
                file_path = Path(root) / file_name
                if should_skip_file(project_dir, file_path):
                    continue
                collected[file_path.relative_to(project_dir).as_posix()] = file_path

    return [collected[key] for key in sorted(collected)]


def compute_source_fingerprint(project_dir: Path) -> str:
    digest = hashlib.sha256()
    files = iter_source_files(project_dir)
    if not files:
        return ""

    for path in files:
        relative_path = path.relative_to(project_dir).as_posix()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            while True:
                chunk = handle.read(65536)
                if not chunk:
                    break
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def resolve_tree_metadata(project_dir: Path) -> dict[str, str]:
    source_fingerprint = compute_source_fingerprint(project_dir)
    git_commit = ""
    git_branch = ""
    git_tag = ""
    git_clean = True
    if is_git_worktree(project_dir):
        git_commit = run_text(["git", "rev-parse", "--short", "HEAD"], cwd=project_dir)
        git_branch = run_text(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=project_dir)
        git_tag = resolve_git_tag(project_dir)
        git_clean = git_status_porcelain(project_dir) == ""
    return {
        "git_commit": git_commit,
        "git_branch": git_branch,
        "git_tag": git_tag,
        "git_clean": git_clean,
        "source_fingerprint": source_fingerprint,
        "source_fingerprint_short": source_fingerprint[:12] if source_fingerprint else "",
    }


def resolve_repo_metadata(project_dir: Path, *, require_clean: bool) -> dict[str, str | bool]:
    if not is_git_worktree(project_dir):
        raise RuntimeError("git worktree required for release reproducibility")

    git_commit = run_text(["git", "rev-parse", "--short", "HEAD"], cwd=project_dir)
    if not git_commit:
        raise RuntimeError("unable to resolve git commit for release reproducibility")

    git_branch = run_text(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=project_dir)
    git_tag = resolve_git_tag(project_dir)
    dirty_output = git_status_porcelain(project_dir)
    git_clean = dirty_output == ""
    if require_clean and not git_clean:
        raise RuntimeError("git worktree is dirty; commit or stash changes before deploy")

    source_fingerprint = compute_source_fingerprint(project_dir)
    if not source_fingerprint:
        raise RuntimeError("unable to compute source fingerprint for release reproducibility")

    return {
        "git_commit": git_commit,
        "git_branch": git_branch,
        "git_tag": git_tag,
        "git_clean": git_clean,
        "source_fingerprint": source_fingerprint,
        "source_fingerprint_short": source_fingerprint[:12],
    }


def resolve_release_state_metadata(release_state_path: Path) -> dict[str, str]:
    raw_data = json.loads(release_state_path.read_text(encoding="utf-8"))
    source_fingerprint = str(raw_data.get("source_fingerprint") or "")
    source_fingerprint_short = str(raw_data.get("source_fingerprint_short") or "")
    if not source_fingerprint_short and source_fingerprint:
        source_fingerprint_short = source_fingerprint[:12]
    return {
        "git_commit": str(raw_data.get("git_commit") or ""),
        "git_branch": str(raw_data.get("git_branch") or ""),
        "git_tag": str(raw_data.get("git_tag") or ""),
        "source_fingerprint": source_fingerprint,
        "source_fingerprint_short": source_fingerprint_short,
    }


def emit_json(metadata: dict[str, object]) -> None:
    json.dump(metadata, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


def emit_env(metadata: dict[str, object]) -> None:
    for key in ("git_commit", "git_branch", "git_tag", "source_fingerprint", "source_fingerprint_short", "git_clean"):
        if key == "git_clean":
            if key not in metadata:
                continue
            value = "1" if metadata.get(key) else "0"
        else:
            value = metadata.get(key) or ""
        if not value:
            continue
        env_key = {
            "git_commit": "SOURCE_GIT_COMMIT",
            "git_branch": "SOURCE_GIT_BRANCH",
            "git_tag": "SOURCE_GIT_TAG",
            "source_fingerprint": "SOURCE_FINGERPRINT",
            "source_fingerprint_short": "SOURCE_FINGERPRINT_SHORT",
            "git_clean": "SOURCE_GIT_CLEAN",
        }[key]
        sys.stdout.write(f"{env_key}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("tree", "repo", "release-state"), required=True)
    parser.add_argument("--project-dir", default=".")
    parser.add_argument("--release-state")
    parser.add_argument("--require-clean", action="store_true")
    parser.add_argument("--format", choices=("json", "env"), default="json")
    args = parser.parse_args()

    try:
        if args.mode == "tree":
            metadata = resolve_tree_metadata(Path(args.project_dir).resolve())
        elif args.mode == "repo":
            metadata = resolve_repo_metadata(Path(args.project_dir).resolve(), require_clean=args.require_clean)
        else:
            if not args.release_state:
                parser.error("--release-state is required for --mode release-state")
            metadata = resolve_release_state_metadata(Path(args.release_state))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.format == "env":
        emit_env(metadata)
    else:
        emit_json(metadata)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
