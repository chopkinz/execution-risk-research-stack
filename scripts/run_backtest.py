from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.backtest.runner import default_run_dir, run_from_config
from src.core.config import load_config


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="configs/nas100_momentum.yaml")
    p.add_argument("--symbol", default=None)
    p.add_argument("--interval", default=None)
    p.add_argument("--period", default=None)
    return p.parse_args()


def main() -> None:
    args = parse_args()
    cfg = load_config(ROOT / args.config)
    if args.symbol:
        cfg["symbol"] = args.symbol
    if args.interval:
        cfg["interval"] = args.interval
    if args.period:
        cfg["period"] = args.period

    out = default_run_dir(ROOT, cfg)
    metrics, run_dir = run_from_config(ROOT, cfg, output_dir=out)
    print(f"Backtest complete: {run_dir}")
    print(metrics)


if __name__ == "__main__":
    main()
