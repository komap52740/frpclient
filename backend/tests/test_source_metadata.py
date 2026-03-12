from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_METADATA_SCRIPT = REPO_ROOT / "ops" / "common" / "source_metadata.py"


def _run_git(repo_dir: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_dir,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout.strip()


def _init_git_repo(repo_dir: Path) -> None:
    _run_git(repo_dir, "init")
    _run_git(repo_dir, "checkout", "-b", "main")
    _run_git(repo_dir, "config", "user.name", "FRP Tests")
    _run_git(repo_dir, "config", "user.email", "tests@example.com")
    (repo_dir / "README.md").write_text("release metadata\n", encoding="utf-8")
    _run_git(repo_dir, "add", "README.md")
    _run_git(repo_dir, "commit", "-m", "init")


def _run_source_metadata(repo_dir: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SOURCE_METADATA_SCRIPT), *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )


def test_source_metadata_repo_mode_reports_commit_branch_and_tag() -> None:
    temp_root = REPO_ROOT / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        repo_dir = Path(temp_dir)
        _init_git_repo(repo_dir)
        _run_git(repo_dir, "tag", "v1.2.3")

        result = _run_source_metadata(
            repo_dir,
            "--mode",
            "repo",
            "--project-dir",
            str(repo_dir),
            "--require-clean",
            "--format",
            "json",
        )

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["git_commit"]
    assert payload["git_branch"] == "main"
    assert payload["git_tag"] == "v1.2.3"
    assert payload["git_clean"] is True
    assert payload["source_fingerprint"]
    assert payload["source_fingerprint_short"] == payload["source_fingerprint"][:12]


def test_source_metadata_repo_mode_fails_for_dirty_tree() -> None:
    temp_root = REPO_ROOT / ".pytest-tmp"
    temp_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        repo_dir = Path(temp_dir)
        _init_git_repo(repo_dir)
        (repo_dir / "README.md").write_text("dirty tree\n", encoding="utf-8")

        result = _run_source_metadata(
            repo_dir,
            "--mode",
            "repo",
            "--project-dir",
            str(repo_dir),
            "--require-clean",
            "--format",
            "json",
        )

    assert result.returncode != 0
    assert "dirty" in result.stderr.lower()
