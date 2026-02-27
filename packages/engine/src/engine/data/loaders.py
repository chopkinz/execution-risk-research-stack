from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import yfinance as yf


@dataclass
class YahooRequest:
    symbol: str
    interval: str
    start: str | None = None
    end: str | None = None
    period: str | None = None
    force_refresh: bool = False


def _normalize(raw: pd.DataFrame) -> pd.DataFrame:
    if raw.empty:
        raise ValueError("No data returned from source")
    df = raw.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.reset_index()
    if "Datetime" in df.columns:
        df = df.rename(columns={"Datetime": "time"})
    elif "Date" in df.columns:
        df = df.rename(columns={"Date": "time"})
    df = df.rename(columns={"Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"})
    cols = ["time", "open", "high", "low", "close", "volume"]
    df = df[cols].copy()
    df["time"] = pd.to_datetime(df["time"], utc=True, errors="coerce")
    df = df.dropna(subset=["time", "open", "high", "low", "close"])
    df = df.sort_values("time").drop_duplicates(subset=["time"]).reset_index(drop=True)
    df["volume"] = df["volume"].fillna(0.0)
    return df


def _cache_key(req: YahooRequest) -> str:
    s = req.symbol.replace("^", "IDX_").replace("=", "_").replace("/", "_")
    return f"{s}_{req.interval}_{req.start or 'na'}_{req.end or 'na'}_{req.period or 'na'}"


def load_yahoo(req: YahooRequest, cache_dir: Path) -> pd.DataFrame:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = cache_dir / f"{_cache_key(req)}.parquet"
    if cache_path.exists() and not req.force_refresh:
        df = pd.read_parquet(cache_path)
        df["time"] = pd.to_datetime(df["time"], utc=True)
        return df

    kwargs = {"tickers": req.symbol, "interval": req.interval, "progress": False, "auto_adjust": False, "threads": False}
    if req.period:
        kwargs["period"] = req.period
    else:
        kwargs["start"] = req.start
        kwargs["end"] = req.end
    raw = yf.download(**kwargs)
    df = _normalize(raw)
    df.to_parquet(cache_path, index=False)
    return df


def load_parquet(path: str | Path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df.sort_values("time").reset_index(drop=True)
