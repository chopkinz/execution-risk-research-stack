from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--run-dir", required=True)
    args = p.parse_args()
    run_dir = Path(args.run_dir)
    report = run_dir / "report.md"
    if report.exists():
        print(f"Report exists: {report}")
    else:
        print("No report found. Run backtest first.")


if __name__ == "__main__":
    main()
