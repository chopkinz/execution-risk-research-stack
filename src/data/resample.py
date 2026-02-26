from __future__ import annotations

import pandas as pd


def resample_ohlcv(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    out = df.copy()
    out["time"] = pd.to_datetime(out["time"], utc=True)
    out = out.set_index("time")
    agg = out.resample(timeframe).agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
    )
    agg = agg.dropna().reset_index()
    return agg
