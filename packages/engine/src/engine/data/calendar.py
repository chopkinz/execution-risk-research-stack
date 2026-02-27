from __future__ import annotations

from datetime import time

import pandas as pd


def add_chicago_time(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["time"] = pd.to_datetime(out["time"], utc=True)
    out["time_ct"] = out["time"].dt.tz_convert("America/Chicago")
    out["date_ct"] = out["time_ct"].dt.date
    out["tod_ct"] = out["time_ct"].dt.time
    return out


def session_mask(df: pd.DataFrame, start: str = "08:30", end: str = "10:30") -> pd.Series:
    h1, m1 = [int(x) for x in start.split(":")]
    h2, m2 = [int(x) for x in end.split(":")]
    s = time(h1, m1)
    e = time(h2, m2)
    return df["tod_ct"].apply(lambda x: bool(s <= x <= e))
