from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from scripts.demo import run_demo
from scripts.sync_ui_artifacts import sync


def main() -> None:
    run_dir = run_demo()
    sync_dir = sync()
    required = [
        Path(run_dir) / "equity_curve.png",
        Path(run_dir) / "drawdown.png",
        Path(run_dir) / "risk_rejections.png",
        Path(run_dir) / "report.md",
        Path(run_dir) / "summary.json",
        Path(sync_dir) / "summary.json",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise SystemExit(f"ui-check failed. Missing artifacts: {missing}")
    print("ui-check ok")


if __name__ == "__main__":
    main()
