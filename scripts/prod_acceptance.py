from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from apps.common.prod_acceptance import run_acceptance


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an end-to-end client acceptance smoke against production.")
    parser.add_argument("--base-url", default="https://frpclient.ru", help="Public deployment URL.")
    parser.add_argument("--username", required=True, help="Temporary verified client username.")
    parser.add_argument("--password", required=True, help="Temporary verified client password.")
    args = parser.parse_args()

    result = run_acceptance(base_url=args.base_url, username=args.username, password=args.password)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
