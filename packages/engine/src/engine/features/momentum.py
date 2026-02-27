from __future__ import annotations

import pandas as pd


def add_momentum(df: pd.DataFrame, lookback: int = 5) -> pd.DataFrame:
    out = df.copy()
    out["ret_1"] = out["close"].pct_change().fillna(0.0)
    # Shifted rolling mean prevents lookahead leakage.
    out["mom"] = out["ret_1"].rolling(lookback, min_periods=lookback).mean().shift(1).fillna(0.0)
    return out
