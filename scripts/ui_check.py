from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from scripts.demo import run_demo


def main() -> None:
    # Import UI module as smoke check.
    from ui.app import main as _app_main  # noqa: F401

    run_dir = run_demo()
    required = [
        Path(run_dir) / "equity_curve.png",
        Path(run_dir) / "drawdown.png",
        Path(run_dir) / "risk_rejections.png",
        Path(run_dir) / "report.md",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise SystemExit(f"ui-check failed. Missing artifacts: {missing}")
    print("ui-check ok")


if __name__ == "__main__":
    main()
