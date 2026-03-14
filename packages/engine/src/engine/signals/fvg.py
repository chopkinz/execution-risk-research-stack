"""
Fair Value Gap (FVG) engine: configurable detection, lifecycle, fill logic, and scoring.

Rules:
- Bullish FVG: candle[i-1].high < candle[i+1].low (gap between bar i-1 high and bar i+1 low).
- Bearish FVG: candle[i-1].low > candle[i+1].high (gap between bar i+1 high and bar i-1 low).

Lifecycle: created -> partially_filled | still_open -> fully_filled | invalidated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd


class FVGStatus(str, Enum):
    CREATED = "created"
    STILL_OPEN = "still_open"
    PARTIALLY_FILLED = "partially_filled"
    FULLY_FILLED = "fully_filled"
    INVALIDATED = "invalidated"


class FillMethod(str, Enum):
    TOUCH = "touch"       # price touches upper (bullish) or lower (bearish) edge
    MIDPOINT = "midpoint" # price crosses midpoint of gap
    FULL_BODY = "full_body"  # price fully crosses gap (closes beyond opposite edge)


@dataclass
class FVGConfig:
    """Configuration for FVG detection and lifecycle."""

    # Minimum gap size filters (at least one can be used)
    min_gap_absolute: float | None = None
    min_gap_ticks: float | None = None
    tick_size: float = 0.01
    min_gap_atr_multiple: float | None = None
    atr_period: int = 14
    min_gap_pct: float | None = None

    # Fill logic
    fill_method: FillMethod = FillMethod.TOUCH

    # Merge overlapping or adjacent gaps (within this many bars)
    merge_adjacent_bars: int = 0  # 0 = no merge

    # Scoring weights (0 = disable)
    score_size_weight: float = 1.0
    score_imbalance_weight: float = 1.0
    score_session_proximity_weight: float = 0.5
    score_trend_weight: float = 0.5


@dataclass
class FVGAnnotation:
    """Structured FVG annotation for chart rendering and strategy use."""

    id: str
    direction: str  # "bullish" | "bearish"
    start_ts: pd.Timestamp
    end_ts: pd.Timestamp
    upper: float
    lower: float
    midpoint: float
    size: float
    size_ticks: float
    atr_multiple: float
    status: FVGStatus
    fill_percent: float
    score: float
    bar_index: int  # center bar index (i)
    type: str = "fvg"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "direction": self.direction,
            "start_ts": self.start_ts.isoformat() if hasattr(self.start_ts, "isoformat") else str(self.start_ts),
            "end_ts": self.end_ts.isoformat() if hasattr(self.end_ts, "isoformat") else str(self.end_ts),
            "upper": self.upper,
            "lower": self.lower,
            "midpoint": self.midpoint,
            "size": self.size,
            "size_ticks": self.size_ticks,
            "atr_multiple": self.atr_multiple,
            "status": self.status.value,
            "fill_percent": self.fill_percent,
            "score": self.score,
            "bar_index": self.bar_index,
            "metadata": self.metadata,
        }


def _atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, period: int) -> np.ndarray:
    tr = np.maximum(high - low, np.maximum(np.abs(high - np.roll(close, 1)), np.abs(low - np.roll(close, 1))))
    tr[0] = high[0] - low[0]
    atr = np.empty_like(close)
    atr[:period] = np.nan
    atr[period - 1] = np.mean(tr[:period])
    for i in range(period, len(close)):
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
    return atr


def _session_high_low(df: pd.DataFrame) -> tuple[float, float]:
    """Session high/low from full series (for proximity scoring)."""
    if df.empty or "high" not in df.columns or "low" not in df.columns:
        return 0.0, 0.0
    return float(df["high"].max()), float(df["low"].min())


def _trend_at_index(close: np.ndarray, i: int, lookback: int = 5) -> float:
    """Simple trend: positive = up, negative = down (return change over lookback)."""
    if i < lookback or i + lookback >= len(close):
        return 0.0
    return float(close[i + lookback] - close[i - lookback])


class FVGEngine:
    """
    Detects FVGs from OHLCV series, updates lifecycle (fill state), and scores each FVG.
    """

    def __init__(self, config: FVGConfig | None = None) -> None:
        self.config = config or FVGConfig()

    def detect(self, df: pd.DataFrame) -> list[FVGAnnotation]:
        """Detect all FVGs in the dataframe and return annotations (no lifecycle update)."""
        return detect_fvgs(
            df,
            min_gap_absolute=self.config.min_gap_absolute,
            min_gap_ticks=self.config.min_gap_ticks,
            tick_size=self.config.tick_size,
            min_gap_atr_multiple=self.config.min_gap_atr_multiple,
            atr_period=self.config.atr_period,
            min_gap_pct=self.config.min_gap_pct,
            merge_adjacent_bars=self.config.merge_adjacent_bars,
            score_size_weight=self.config.score_size_weight,
            score_imbalance_weight=self.config.score_imbalance_weight,
            score_session_proximity_weight=self.config.score_session_proximity_weight,
            score_trend_weight=self.config.score_trend_weight,
        )

    def update_fill_states(
        self,
        fvgs: list[FVGAnnotation],
        df: pd.DataFrame,
        fill_method: FillMethod | None = None,
    ) -> list[FVGAnnotation]:
        """
        Update each FVG's status and fill_percent based on price action after creation.
        Uses high/low of bars after the FVG's bar_index to determine fill.
        """
        method = fill_method or self.config.fill_method
        out: list[FVGAnnotation] = []
        for fvg in fvgs:
            updated = _update_single_fvg_fill(fvg, df, method)
            out.append(updated)
        return out


def _update_single_fvg_fill(fvg: FVGAnnotation, df: pd.DataFrame, method: FillMethod) -> FVGAnnotation:
    """Update one FVG's status and fill_percent from df."""
    if fvg.bar_index >= len(df) - 1:
        return fvg

    high = df["high"].values
    low = df["low"].values
    start_idx = fvg.bar_index + 1
    fill_pct = 0.0
    status = fvg.status

    if fvg.direction == "bullish":
        # Gap is between lower and upper; fill when price comes down into gap
        lower, upper = fvg.lower, fvg.upper
        for j in range(start_idx, len(df)):
            bar_low = low[j]
            bar_high = high[j]
            if method == FillMethod.TOUCH:
                if bar_low <= lower:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_low < upper:
                    fill_pct = max(fill_pct, (upper - bar_low) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
            elif method == FillMethod.MIDPOINT:
                if bar_low <= fvg.midpoint:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_low < upper:
                    fill_pct = max(fill_pct, (upper - bar_low) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
            else:  # FULL_BODY: close below lower
                if "close" in df.columns and df["close"].iloc[j] <= lower:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_low < upper:
                    fill_pct = max(fill_pct, (upper - bar_low) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
        if status == fvg.status and fill_pct == 0:
            status = FVGStatus.STILL_OPEN
    else:
        # Bearish: fill when price comes up into gap
        lower, upper = fvg.lower, fvg.upper
        for j in range(start_idx, len(df)):
            bar_high = high[j]
            bar_low = low[j]
            if method == FillMethod.TOUCH:
                if bar_high >= upper:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_high > lower:
                    fill_pct = max(fill_pct, (bar_high - lower) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
            elif method == FillMethod.MIDPOINT:
                if bar_high >= fvg.midpoint:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_high > lower:
                    fill_pct = max(fill_pct, (bar_high - lower) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
            else:
                if "close" in df.columns and df["close"].iloc[j] >= upper:
                    fill_pct = 1.0
                    status = FVGStatus.FULLY_FILLED
                    break
                if bar_high > lower:
                    fill_pct = max(fill_pct, (bar_high - lower) / (upper - lower) if upper > lower else 0)
                    status = FVGStatus.PARTIALLY_FILLED if fill_pct < 1.0 else FVGStatus.FULLY_FILLED
        if status == fvg.status and fill_pct == 0:
            status = FVGStatus.STILL_OPEN

    return FVGAnnotation(
        id=fvg.id,
        type=fvg.type,
        direction=fvg.direction,
        start_ts=fvg.start_ts,
        end_ts=fvg.end_ts,
        upper=fvg.upper,
        lower=fvg.lower,
        midpoint=fvg.midpoint,
        size=fvg.size,
        size_ticks=fvg.size_ticks,
        atr_multiple=fvg.atr_multiple,
        status=status,
        fill_percent=min(1.0, fill_pct),
        score=fvg.score,
        bar_index=fvg.bar_index,
        metadata=dict(fvg.metadata),
    )


def detect_fvgs(
    df: pd.DataFrame,
    *,
    min_gap_absolute: float | None = None,
    min_gap_ticks: float | None = None,
    tick_size: float = 0.01,
    min_gap_atr_multiple: float | None = None,
    atr_period: int = 14,
    min_gap_pct: float | None = None,
    merge_adjacent_bars: int = 0,
    score_size_weight: float = 1.0,
    score_imbalance_weight: float = 1.0,
    score_session_proximity_weight: float = 0.5,
    score_trend_weight: float = 0.5,
) -> list[FVGAnnotation]:
    """
    Detect bullish and bearish FVGs from OHLC dataframe.

    - Bullish: high[i-1] < low[i+1] (gap between candle i-1 high and candle i+1 low).
    - Bearish: low[i-1] > high[i+1] (gap between candle i+1 high and candle i-1 low).

    Column names expected: time, open, high, low, close (and optionally volume).
    """
    if df.empty or len(df) < 3:
        return []

    df = df.reset_index(drop=True)
    times = df["time"] if "time" in df.columns else pd.RangeIndex(len(df))
    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    close = df["close"].values.astype(float) if "close" in df.columns else (high + low) / 2

    atr_arr = _atr(high, low, close, atr_period) if min_gap_atr_multiple is not None else np.full(len(df), np.nan)
    session_high, session_low = _session_high_low(df)

    def _ts(idx: int) -> pd.Timestamp:
        try:
            t = times.iloc[idx] if hasattr(times, "iloc") else times[idx]
        except Exception:
            t = None
        if isinstance(t, pd.Timestamp):
            return t
        if isinstance(t, (int, float)):
            return pd.Timestamp(t, unit="s", tz="UTC")
        return pd.Timestamp.now(tz="UTC")

    raw: list[FVGAnnotation] = []
    for i in range(1, len(df) - 1):
        # Bullish FVG: candle[i-1].high < candle[i+1].low
        if high[i - 1] < low[i + 1]:
            gap_size = low[i + 1] - high[i - 1]
            if _filter_gap(gap_size, high[i - 1], tick_size, atr_arr[i], min_gap_absolute, min_gap_ticks, min_gap_atr_multiple, min_gap_pct):
                continue
            atr_mult = gap_size / atr_arr[i] if atr_arr[i] and not np.isnan(atr_arr[i]) and atr_arr[i] > 0 else 0.0
            start_ts = _ts(i - 1)
            end_ts = _ts(i + 1)
            score = _score_fvg(
                gap_size, "bullish", high[i - 1], low[i + 1], session_high, session_low,
                _trend_at_index(close, i), score_size_weight, score_imbalance_weight,
                score_session_proximity_weight, score_trend_weight,
            )
            raw.append(FVGAnnotation(
                id=f"fvg_bull_{i}_{hash((high[i-1], low[i+1])) & 0x7FFFFFFF}",
                type="fvg",
                direction="bullish",
                start_ts=start_ts,
                end_ts=end_ts,
                upper=float(low[i + 1]),
                lower=float(high[i - 1]),
                midpoint=float((high[i - 1] + low[i + 1]) / 2),
                size=gap_size,
                size_ticks=gap_size / tick_size if tick_size > 0 else 0,
                atr_multiple=atr_mult,
                status=FVGStatus.CREATED,
                fill_percent=0.0,
                score=score,
                bar_index=i,
                metadata={"center_bar": i},
            ))

        # Bearish FVG: candle[i-1].low > candle[i+1].high
        if low[i - 1] > high[i + 1]:
            gap_size = low[i - 1] - high[i + 1]
            if _filter_gap(gap_size, high[i + 1], tick_size, atr_arr[i], min_gap_absolute, min_gap_ticks, min_gap_atr_multiple, min_gap_pct):
                continue
            atr_mult = gap_size / atr_arr[i] if atr_arr[i] and not np.isnan(atr_arr[i]) and atr_arr[i] > 0 else 0.0
            start_ts = _ts(i - 1)
            end_ts = _ts(i + 1)
            score = _score_fvg(
                gap_size, "bearish", high[i + 1], low[i - 1], session_high, session_low,
                _trend_at_index(close, i), score_size_weight, score_imbalance_weight,
                score_session_proximity_weight, score_trend_weight,
            )
            raw.append(FVGAnnotation(
                id=f"fvg_bear_{i}_{hash((high[i+1], low[i-1])) & 0x7FFFFFFF}",
                type="fvg",
                direction="bearish",
                start_ts=start_ts,
                end_ts=end_ts,
                upper=float(low[i - 1]),
                lower=float(high[i + 1]),
                midpoint=float((high[i + 1] + low[i - 1]) / 2),
                size=gap_size,
                size_ticks=gap_size / tick_size if tick_size > 0 else 0,
                atr_multiple=atr_mult,
                status=FVGStatus.CREATED,
                fill_percent=0.0,
                score=score,
                bar_index=i,
                metadata={"center_bar": i},
            ))

    if merge_adjacent_bars > 0:
        raw = _merge_adjacent_fvgs(raw, merge_adjacent_bars)

    # Ensure unique ids
    seen: set[str] = set()
    result: list[FVGAnnotation] = []
    for i, a in enumerate(raw):
        uid = a.id
        if uid in seen:
            uid = f"{a.id}_{i}"
            a = FVGAnnotation(
                id=uid, type=a.type, direction=a.direction, start_ts=a.start_ts, end_ts=a.end_ts,
                upper=a.upper, lower=a.lower, midpoint=a.midpoint, size=a.size, size_ticks=a.size_ticks,
                atr_multiple=a.atr_multiple, status=a.status, fill_percent=a.fill_percent, score=a.score,
                bar_index=a.bar_index, metadata=dict(a.metadata),
            )
        seen.add(a.id)
        result.append(a)
    return result


def _filter_gap(
    gap_size: float,
    ref_price: float,
    tick_size: float,
    atr_val: float,
    min_abs: float | None,
    min_ticks: float | None,
    min_atr: float | None,
    min_pct: float | None,
) -> bool:
    """Return True if gap should be filtered out."""
    if min_abs is not None and gap_size < min_abs:
        return True
    if min_ticks is not None and tick_size > 0 and (gap_size / tick_size) < min_ticks:
        return True
    if min_atr is not None and (atr_val <= 0 or np.isnan(atr_val) or (gap_size / atr_val) < min_atr):
        return True
    if min_pct is not None and ref_price != 0 and (gap_size / abs(ref_price)) * 100 < min_pct:
        return True
    return False


def _score_fvg(
    size: float,
    direction: str,
    lower: float,
    upper: float,
    session_high: float,
    session_low: float,
    trend: float,
    w_size: float,
    w_imbalance: float,
    w_session: float,
    w_trend: float,
) -> float:
    """Score FVG by size, imbalance, proximity to session H/L, trend alignment."""
    score = 0.0
    if w_size > 0 and size > 0:
        score += w_size * min(size / max(session_high - session_low, 1e-9), 2.0)
    if w_imbalance > 0:
        score += w_imbalance * min(size / max(lower, 1e-9) * 100, 2.0)
    if w_session > 0 and session_high > session_low:
        mid = (upper + lower) / 2
        dist_to_high = abs(session_high - mid)
        dist_to_low = abs(session_low - mid)
        range_size = session_high - session_low
        proximity = 1.0 - min(dist_to_high, dist_to_low) / range_size
        score += w_session * proximity
    if w_trend != 0:
        if (direction == "bullish" and trend > 0) or (direction == "bearish" and trend < 0):
            score += w_trend * min(abs(trend) / max(upper - lower, 1e-9), 1.0)
    return max(0.0, score)


def _merge_adjacent_fvgs(fvgs: list[FVGAnnotation], max_bar_gap: int) -> list[FVGAnnotation]:
    """Merge FVGs of same direction that are within max_bar_gap bars of each other."""
    if not fvgs or max_bar_gap <= 0:
        return fvgs
    by_dir: dict[str, list[FVGAnnotation]] = {"bullish": [], "bearish": []}
    for f in fvgs:
        by_dir[f.direction].append(f)
    out: list[FVGAnnotation] = []
    for direction, group in by_dir.items():
        group = sorted(group, key=lambda x: x.bar_index)
        i = 0
        while i < len(group):
            curr = group[i]
            merged_upper = curr.upper
            merged_lower = curr.lower
            merged_end = curr.end_ts
            merged_start = curr.start_ts
            j = i + 1
            while j < len(group) and group[j].bar_index <= curr.bar_index + max_bar_gap:
                n = group[j]
                merged_lower = min(merged_lower, n.lower)
                merged_upper = max(merged_upper, n.upper)
                merged_end = n.end_ts
                j += 1
            if j > i + 1:
                size = merged_upper - merged_lower
                curr = FVGAnnotation(
                    id=curr.id + "_m",
                    type=curr.type,
                    direction=curr.direction,
                    start_ts=merged_start,
                    end_ts=merged_end,
                    upper=merged_upper,
                    lower=merged_lower,
                    midpoint=(merged_upper + merged_lower) / 2,
                    size=size,
                    size_ticks=curr.size_ticks,
                    atr_multiple=curr.atr_multiple,
                    status=curr.status,
                    fill_percent=curr.fill_percent,
                    score=curr.score,
                    bar_index=curr.bar_index,
                    metadata={**curr.metadata, "merged": True},
                )
            out.append(curr)
            i = j
    return out
