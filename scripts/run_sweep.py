from __future__ import annotations

import argparse
import copy
from datetime import datetime
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.backtest.sweep import SweepParams, build_grid
from src.backtest.runner import run_from_config
from src.core.config import load_config
from src.data.loaders import YahooRequest, load_yahoo
from src.data.storage import ensure_dirs


def _score_row(row: pd.Series, prefer_high_win_rate: bool) -> float:
    # Higher is better: expectancy + PF + mild DD penalty (+ optional win-rate preference)
    score = float(row.get("expectancy_r", 0.0))
    score += 0.10 * float(row.get("profit_factor", 0.0))
    score -= 0.02 * abs(float(row.get("max_drawdown_pct", 0.0)))
    if prefer_high_win_rate:
        score += 0.50 * float(row.get("win_rate", 0.0))
    return score


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-config", default="configs/nas100_momentum.yaml")
    p.add_argument("--prefer-high-win-rate", action="store_true")
    args = p.parse_args()
    cfg = load_config(ROOT / args.base_config)
    dirs = ensure_dirs(ROOT)
    data = load_yahoo(
        YahooRequest(symbol=cfg["symbol"], interval=cfg["interval"], period=cfg.get("period")),
        cache_dir=dirs["data"],
    )

    grid = build_grid(
        SweepParams(
            impulse_k=[1.2, 1.5, 1.8],
            tap_pct=[0.3, 0.5],
            confirmation_strength=[0.5, 0.7],
            r_multiple=[1.5, 2.0],
            time_stop=[10],
            chop_filter=[0.0],
        )
    )

    rows: list[dict] = []
    for g in grid:
        run_cfg = copy.deepcopy(cfg)
        # v1 mapping: use impulse_k as momentum threshold proxy.
        run_cfg["strategy"]["threshold"] = float(g["impulse_k"]) / 1000.0
        run_cfg["execution"]["slippage_k"] = 0.08 + (float(g["tap_pct"]) * 0.05)
        metrics, run_dir = run_from_config(ROOT, run_cfg, data=data)
        rows.append({**g, **metrics, "run_dir": run_dir})

    df = pd.DataFrame(rows)
    df["score"] = df.apply(lambda r: _score_row(r, args.prefer_high_win_rate), axis=1)
    df = df.sort_values(["score", "expectancy_r", "profit_factor"], ascending=False).reset_index(drop=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = ROOT / "outputs" / f"sweep_results_{ts}.csv"
    df.to_csv(out, index=False)
    print(f"Sweep artifact saved: {out}")
    print(df.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
