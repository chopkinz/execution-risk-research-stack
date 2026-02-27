from __future__ import annotations

import numpy as np
import pandas as pd


def generate_synthetic_ohlcv(
    n_bars: int = 300,
    start: str = "2026-01-05 14:30:00+00:00",
    freq: str = "15min",
    seed: int = 42,
    start_price: float = 20000.0,
) -> pd.DataFrame:
    """Generate deterministic OHLCV bars for offline demos/tests."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start=start, periods=n_bars, freq=freq, tz="UTC")

    steps = rng.normal(loc=0.0, scale=12.0, size=n_bars)
    close = start_price + np.cumsum(steps)
    open_ = np.concatenate([[start_price], close[:-1]])
    high = np.maximum(open_, close) + rng.uniform(2.0, 8.0, size=n_bars)
    low = np.minimum(open_, close) - rng.uniform(2.0, 8.0, size=n_bars)
    volume = rng.integers(low=80, high=250, size=n_bars).astype(float)

    out = pd.DataFrame(
        {
            "time": idx,
            "open": open_.astype(float),
            "high": high.astype(float),
            "low": low.astype(float),
            "close": close.astype(float),
            "volume": volume,
        }
    )
    out["time"] = pd.to_datetime(out["time"], utc=True)
    return out
