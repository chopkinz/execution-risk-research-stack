"""
Session engine: Asia, London, New York with America/Chicago default and DST-safe windows.

Session windows are configurable (e.g. via config files). Each session computes
open, close, high, low, range, midpoint. Also computes Asia/London/NY highs and lows,
previous day high/low, current day open. Outputs structured annotations for chart overlays.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd


# Default session windows (Chicago time for US equities/futures)
# Asia: 18:00 CT prev – 02:00 CT (approx); London: 02:00 – 10:00 CT; NY: 08:30 – 15:00 CT
# Stored as (start_hour, start_min), (end_hour, end_min) in Chicago
DEFAULT_ASIA_START = (18, 0)   # 18:00 CT previous day
DEFAULT_ASIA_END = (2, 0)     # 02:00 CT next calendar day
DEFAULT_LONDON_START = (2, 0)
DEFAULT_LONDON_END = (10, 0)
DEFAULT_NY_START = (8, 30)
DEFAULT_NY_END = (15, 0)


@dataclass
class SessionConfig:
    """Configurable session windows. Times in America/Chicago."""

    timezone: str = "America/Chicago"
    # (hour, minute) 24h
    asia_start: tuple[int, int] = DEFAULT_ASIA_START
    asia_end: tuple[int, int] = DEFAULT_ASIA_END
    london_start: tuple[int, int] = DEFAULT_LONDON_START
    london_end: tuple[int, int] = DEFAULT_LONDON_END
    ny_start: tuple[int, int] = DEFAULT_NY_START
    ny_end: tuple[int, int] = DEFAULT_NY_END


@dataclass
class SessionAnnotation:
    """Single session-level annotation for chart overlay (e.g. session box or level)."""

    id: str
    name: str  # Asia, London, NY, prev_day, current_day
    open_ts: pd.Timestamp | None
    close_ts: pd.Timestamp | None
    open_price: float
    close_price: float
    high: float
    low: float
    range: float
    midpoint: float
    type: str = "session"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "open_ts": self.open_ts.isoformat() if self.open_ts and hasattr(self.open_ts, "isoformat") else str(self.open_ts),
            "close_ts": self.close_ts.isoformat() if self.close_ts and hasattr(self.close_ts, "isoformat") else str(self.close_ts),
            "open_price": self.open_price,
            "close_price": self.close_price,
            "high": self.high,
            "low": self.low,
            "range": self.range,
            "midpoint": self.midpoint,
            "metadata": self.metadata,
        }


def _to_time(t: tuple[int, int]) -> time:
    return time(t[0], t[1])


def _in_session(t: time, start: time, end: time) -> bool:
    """True if t is within [start, end]. Handles overnight (e.g. Asia 18:00–02:00)."""
    if start <= end:
        return start <= t <= end
    return t >= start or t <= end


def _session_name(t_ct: time, cfg: SessionConfig) -> str | None:
    if _in_session(t_ct, _to_time(cfg.asia_start), _to_time(cfg.asia_end)):
        return "Asia"
    if _in_session(t_ct, _to_time(cfg.london_start), _to_time(cfg.london_end)):
        return "London"
    if _in_session(t_ct, _to_time(cfg.ny_start), _to_time(cfg.ny_end)):
        return "NY"
    return None


class SessionEngine:
    """Compute session highs/lows and levels from OHLCV data with DST-safe timezone."""

    def __init__(self, config: SessionConfig | None = None) -> None:
        self.config = config or SessionConfig()

    def compute(self, df: pd.DataFrame) -> list[SessionAnnotation]:
        """Compute session annotations from dataframe. Expects columns: time, open, high, low, close."""
        return compute_sessions(df, self.config)


def _aggregate_bars(
    bars: list[tuple[Any, float, float, float, float]],
) -> tuple[float, float, float, float, pd.Timestamp | None, pd.Timestamp | None]:
    """Aggregate list of (ts, open, high, low, close) to high, low, open, close, open_ts, close_ts."""
    if not bars:
        return 0.0, 0.0, 0.0, 0.0, None, None
    high = max(b[2] for b in bars)
    low = min(b[3] for b in bars)
    open_price = bars[0][1]
    close_price = bars[-1][4]
    open_ts = bars[0][0]
    close_ts = bars[-1][0]
    return high, low, open_price, close_price, open_ts, close_ts


def compute_sessions(df: pd.DataFrame, config: SessionConfig | None = None) -> list[SessionAnnotation]:
    """
    Compute session open/close/high/low/range/midpoint for Asia, London, NY,
    plus previous day high/low and current day open. DST-safe via zoneinfo.
    Single-pass bucket fill O(n); aggregation O(k). No groupby, no per-row apply.
    """
    if df.empty or "time" not in df.columns:
        return []

    config = config or SessionConfig()
    tz = ZoneInfo(config.timezone)
    time_utc = pd.to_datetime(df["time"], utc=True)
    time_ct = time_utc.dt.tz_convert(tz)
    date_ct = time_ct.dt.date
    tod_ct = time_ct.dt.time

    # Buckets: one pass over rows. O(n).
    session_buckets: dict[tuple[Any, str], list[tuple[Any, float, float, float, float]]] = {}
    day_buckets: dict[Any, list[tuple[Any, float, float, float, float]]] = {}

    for i in range(len(df)):
        ts = time_utc.iloc[i]
        o, h, l, c = float(df["open"].iloc[i]), float(df["high"].iloc[i]), float(df["low"].iloc[i]), float(df["close"].iloc[i])
        dc = date_ct.iloc[i]
        tod = tod_ct.iloc[i]
        session_name = _session_name(tod, config)
        if session_name:
            key = (dc, session_name)
            session_buckets.setdefault(key, []).append((ts, o, h, l, c))
        day_buckets.setdefault(dc, []).append((ts, o, h, l, c))

    annotations: list[SessionAnnotation] = []

    for (date_ct, session_name), bars in session_buckets.items():
        high, low, open_price, close_price, open_ts, close_ts = _aggregate_bars(bars)
        rng = high - low
        mid = (high + low) / 2
        annotations.append(SessionAnnotation(
            id=f"session_{date_ct}_{session_name}",
            type="session",
            name=session_name,
            open_ts=open_ts,
            close_ts=close_ts,
            open_price=open_price,
            close_price=close_price,
            high=high,
            low=low,
            range=rng,
            midpoint=mid,
            metadata={"date_ct": str(date_ct)},
        ))

    sorted_dates = sorted(day_buckets.keys())
    prev_high: float | None = None
    prev_low: float | None = None
    for date_ct in sorted_dates:
        bars = day_buckets[date_ct]
        day_high, day_low, day_open, day_close, open_ts, close_ts = _aggregate_bars(bars)
        annotations.append(SessionAnnotation(
            id=f"day_{date_ct}",
            type="session",
            name="current_day",
            open_ts=open_ts,
            close_ts=close_ts,
            open_price=day_open,
            close_price=day_close,
            high=day_high,
            low=day_low,
            range=day_high - day_low,
            midpoint=(day_high + day_low) / 2,
            metadata={"date_ct": str(date_ct), "day_high": day_high, "day_low": day_low},
        ))
        if prev_high is not None and prev_low is not None:
            annotations.append(SessionAnnotation(
                id=f"prev_day_{date_ct}",
                type="session",
                name="prev_day",
                open_ts=open_ts,
                close_ts=close_ts,
                open_price=prev_high,
                close_price=prev_low,
                high=prev_high,
                low=prev_low,
                range=prev_high - prev_low,
                midpoint=(prev_high + prev_low) / 2,
                metadata={"date_ct": str(date_ct), "prev_high": prev_high, "prev_low": prev_low},
            ))
        prev_high = day_high
        prev_low = day_low

    annotations.sort(key=lambda a: (a.open_ts or pd.Timestamp.min))
    return annotations[-48:]
