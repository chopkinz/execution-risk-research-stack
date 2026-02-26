from __future__ import annotations

import pandas as pd


def validate_ohlcv(df: pd.DataFrame) -> None:
    required = {"time", "open", "high", "low", "close", "volume"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {sorted(missing)}")
    if df["time"].duplicated().any():
        raise ValueError("Duplicate timestamps found")
    if (df["high"] < df["low"]).any():
        raise ValueError("Invalid bars: high < low")
