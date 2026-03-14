"""
Run backtest from a config file (YAML or JSON). Used by the web API for simulation lab.

Usage:
  python -m engine.scripts.run_config --config path/to/config.yaml --out path/to/output
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from engine.backtest.runner import run_from_config
from engine.core.config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="Run backtest from config file.")
    parser.add_argument("--config", required=True, help="Path to config YAML or JSON.")
    parser.add_argument("--out", required=True, help="Output directory for artifacts.")
    parser.add_argument("--root", default=None, help="Repo root for data/cache (default: config parent).")
    args = parser.parse_args()
    config_path = Path(args.config)
    out_path = Path(args.out)
    root = Path(args.root) if args.root else config_path.resolve().parent
    if not config_path.exists():
        print(f"Config not found: {config_path}", file=sys.stderr)
        sys.exit(1)
    cfg = load_config(config_path)
    out_path.mkdir(parents=True, exist_ok=True)
    try:
        metrics, run_dir = run_from_config(root, cfg, output_dir=out_path)
        print(json.dumps({"ok": True, "run_dir": str(run_dir), "metrics": metrics}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
