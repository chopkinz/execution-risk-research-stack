from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from scripts.demo import run_demo


def main() -> None:
    out = Path(run_demo())
    required = ["equity_curve.png", "drawdown.png", "risk_rejections.png", "report.md"]
    missing = [name for name in required if not (out / name).exists()]
    if missing:
        raise SystemExit(f"ui-check failed: missing {missing}")
    print("ui-check ok (no interactive UI in this repo)")


if __name__ == "__main__":
    main()
