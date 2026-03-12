from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PREFLIGHT_SCRIPT = REPO_ROOT / "scripts" / "prod_preflight.py"
ROOT_STAGE_ENV = REPO_ROOT / ".env.staging.example"
BACKEND_STAGE_ENV = REPO_ROOT / "backend" / ".env.staging.example"
BACKEND_STAGE_SECRETS = REPO_ROOT / "ops" / "secrets" / "backend.staging.secrets.env.example"
FRONTEND_STAGE_SECRETS = REPO_ROOT / "ops" / "secrets" / "frontend.staging.build.secrets.env.example"


def _write_with_replacements(source: Path, target: Path, replacements: dict[str, str]) -> None:
    content = source.read_text(encoding="utf-8")
    for old_value, new_value in replacements.items():
        content = content.replace(old_value, new_value)
    target.write_text(content, encoding="utf-8")


def test_staging_example_env_passes_preflight() -> None:
    temp_root = REPO_ROOT.parent / ".pytest-staging-preflight"
    temp_root.mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory(dir=temp_root) as temp_dir:
        temp_path = Path(temp_dir)
        root_env = temp_path / ".env.staging"
        backend_env = temp_path / "backend.env"
        backend_secrets = temp_path / "backend.secrets.env"
        frontend_secrets = temp_path / "frontend.build.secrets.env"

        _write_with_replacements(
            ROOT_STAGE_ENV,
            root_env,
            {
                "./backend/.env.staging": str(backend_env).replace("\\", "/"),
                "/etc/frpclient/backend.staging.secrets.env": str(backend_secrets).replace("\\", "/"),
                "/etc/frpclient/frontend.staging.build.secrets.env": str(frontend_secrets).replace("\\", "/"),
            },
        )
        _write_with_replacements(BACKEND_STAGE_ENV, backend_env, {})
        _write_with_replacements(BACKEND_STAGE_SECRETS, backend_secrets, {})
        _write_with_replacements(FRONTEND_STAGE_SECRETS, frontend_secrets, {})

        result = subprocess.run(
            [
                sys.executable,
                str(PREFLIGHT_SCRIPT),
                "--base-url",
                "https://staging.frpclient.ru",
                "--root-env",
                str(root_env),
                "--backend-env",
                str(backend_env),
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )

    assert result.returncode == 0, result.stderr or result.stdout
    assert "Preflight passed" in result.stdout
