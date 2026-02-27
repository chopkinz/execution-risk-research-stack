from __future__ import annotations

import math

import numpy as np
import pandas as pd


def max_drawdown(equity: pd.Series) -> float:
    high = equity.cummax()
    dd = (equity - high) / high.replace(0, np.nan)
    return float(dd.min()) if len(dd) else 0.0


def compute_metrics(trades: pd.DataFrame, equity_curve: pd.DataFrame, initial_equity: float) -> dict[str, float]:
    if trades.empty:
        end_equity = float(equity_curve["equity"].iloc[-1]) if not equity_curve.empty else initial_equity
        return {
            "trades": 0,
            "win_rate": 0.0,
            "avg_r": 0.0,
            "expectancy_r": 0.0,
            "profit_factor": 0.0,
            "net_pnl": end_equity - initial_equity,
            "max_drawdown_pct": max_drawdown(equity_curve["equity"]) * 100 if not equity_curve.empty else 0.0,
        }
    t = trades.copy()
    t["pnl"] = pd.to_numeric(t["pnl"], errors="coerce")
    t["r_multiple"] = pd.to_numeric(t["r_multiple"], errors="coerce")
    wins = t[t["pnl"] > 0]["pnl"].sum()
    losses = abs(t[t["pnl"] < 0]["pnl"].sum())
    pf = float(wins / losses) if losses > 0 else 0.0
    daily = equity_curve.groupby("date")["equity"].last().pct_change().dropna() if not equity_curve.empty else pd.Series(dtype=float)
    sharpe = float((daily.mean() / daily.std(ddof=0)) * math.sqrt(252)) if len(daily) and daily.std(ddof=0) > 0 else 0.0
    return {
        "trades": int(len(t)),
        "win_rate": float((t["pnl"] > 0).mean()),
        "avg_r": float(t["r_multiple"].mean()),
        "expectancy_r": float(t["r_multiple"].mean()),
        "profit_factor": pf,
        "net_pnl": float(t["pnl"].sum()),
        "max_drawdown_pct": max_drawdown(equity_curve["equity"]) * 100 if not equity_curve.empty else 0.0,
        "sharpe_like": sharpe,
    }
