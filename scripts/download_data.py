from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.data.loaders import YahooRequest, load_yahoo
from src.data.storage import ensure_dirs


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--symbol", required=True)
    p.add_argument("--interval", required=True)
    p.add_argument("--period", default="60d")
    args = p.parse_args()
    dirs = ensure_dirs(ROOT)
    df = load_yahoo(YahooRequest(symbol=args.symbol, interval=args.interval, period=args.period), cache_dir=dirs["data"])
    print(f"rows={len(df)}")


if __name__ == "__main__":
    main()
