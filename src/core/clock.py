from __future__ import annotations

import pandas as pd


def to_chicago(ts: pd.Series) -> pd.Series:
    return pd.to_datetime(ts, utc=True, errors="coerce").dt.tz_convert("America/Chicago")


def date_key(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%d")
