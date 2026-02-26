from __future__ import annotations

import numpy as np
import pandas as pd


def monte_carlo_trade_resample(trades: pd.DataFrame, initial_equity: float, n_paths: int = 500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    returns = pd.to_numeric(trades["pnl"], errors="coerce").dropna().values if not trades.empty else np.array([])
    if returns.size == 0:
        return pd.DataFrame(columns=["path", "end_equity", "max_drawdown_pct"])

    rows = []
    for i in range(n_paths):
        sample = rng.choice(returns, size=len(returns), replace=True)
        eq = initial_equity + np.cumsum(sample)
        roll = np.maximum.accumulate(eq)
        dd = (eq - roll) / roll
        rows.append({"path": i, "end_equity": float(eq[-1]), "max_drawdown_pct": float(dd.min() * 100.0)})
    return pd.DataFrame(rows)
