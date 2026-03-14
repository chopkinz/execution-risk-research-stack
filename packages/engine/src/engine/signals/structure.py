"""
Market structure: swing highs/lows, HH/HL/LH/LL, break of structure (BOS), change of character (CHoCH).

Provides structured annotations for chart overlays. Optional fractal-based swing detection.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd


class StructureLabel(str, Enum):
    HH = "HH"
    HL = "HL"
    LH = "LH"
    LL = "LL"
    BOS_BULL = "BOS_bull"
    BOS_BEAR = "BOS_bear"
    CHOCH_BULL = "CHoCH_bull"
    CHOCH_BEAR = "CHoCH_bear"


@dataclass
class StructureAnnotation:
    """Single market structure annotation for chart rendering."""

    id: str
    label: str  # HH, HL, LH, LL, BOS_bull, BOS_bear, CHoCH_bull, CHoCH_bear
    ts: pd.Timestamp
    price: float
    bar_index: int
    is_high: bool  # True = swing high, False = swing low
    internal: bool = False  # internal vs external structure
    type: str = "structure"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "label": self.label,
            "ts": self.ts.isoformat() if hasattr(self.ts, "isoformat") else str(self.ts),
            "price": self.price,
            "bar_index": self.bar_index,
            "is_high": self.is_high,
            "internal": self.internal,
            "metadata": self.metadata,
        }


@dataclass
class StructureConfig:
    """Configuration for swing and structure detection."""

    swing_left_bars: int = 2
    swing_right_bars: int = 2
    fractal_bars: int = 2  # bars on each side for fractal (e.g. 2 = 5-bar fractal)
    use_fractal: bool = False
    internal_only: bool = False  # only label internal structure
    external_only: bool = False  # only label external (session-level) structure


def _swing_high_indices(high: np.ndarray, left: int, right: int) -> np.ndarray:
    """
    Indices where high[i] is a local max over [i-left, i+right]. O(n) via sliding window view.
    Center index in window is left; we require high[i] >= max(window).
    """
    size = left + right + 1
    if len(high) < size:
        return np.array([], dtype=int)
    from numpy.lib.stride_tricks import sliding_window_view
    windows = sliding_window_view(high.astype(float), size)
    # Row j covers indices [j..j+size-1]; center is at j+left. Local max iff center equals max of window.
    is_max = windows[:, left] >= np.max(windows, axis=1)
    return np.where(is_max)[0] + left


def _swing_low_indices(low: np.ndarray, left: int, right: int) -> np.ndarray:
    """
    Indices where low[i] is a local min over [i-left, i+right]. O(n) via sliding window view.
    """
    size = left + right + 1
    if len(low) < size:
        return np.array([], dtype=int)
    from numpy.lib.stride_tricks import sliding_window_view
    windows = sliding_window_view(low.astype(float), size)
    is_min = windows[:, left] <= np.min(windows, axis=1)
    return np.where(is_min)[0] + left


class StructureEngine:
    """Detects swing points and labels HH/HL/LH/LL, BOS, CHoCH."""

    def __init__(self, config: StructureConfig | None = None) -> None:
        self.config = config or StructureConfig()

    def detect(self, df: pd.DataFrame) -> list[StructureAnnotation]:
        """Return all structure annotations for the series."""
        return detect_structure(
            df,
            swing_left_bars=self.config.swing_left_bars,
            swing_right_bars=self.config.swing_right_bars,
            fractal_bars=self.config.fractal_bars,
            use_fractal=self.config.use_fractal,
            internal_only=self.config.internal_only,
            external_only=self.config.external_only,
        )


def detect_structure(
    df: pd.DataFrame,
    *,
    swing_left_bars: int = 2,
    swing_right_bars: int = 2,
    fractal_bars: int = 2,
    use_fractal: bool = False,
    internal_only: bool = False,
    external_only: bool = False,
) -> list[StructureAnnotation]:
    """
    Detect swing highs/lows and label HH, HL, LH, LL, then BOS and CHoCH.

    - Swing high: local max over [i-left, i+right].
    - Swing low: local min over [i-left, i+right].
    - HH: swing high > prior swing high. HL: swing high but lower than prior.
    - LH: swing high < prior. LL: swing low < prior swing low.
    - BOS: break of structure (price takes out prior swing in trend direction).
    - CHoCH: change of character (break against trend, potential reversal).
    """
    if df.empty or len(df) < 5:
        return []

    df = df.reset_index(drop=True)
    high = df["high"].values.astype(float)
    low = df["low"].values.astype(float)
    times = df["time"] if "time" in df.columns else pd.RangeIndex(len(df))

    left = fractal_bars if use_fractal else swing_left_bars
    right = fractal_bars if use_fractal else swing_right_bars

    sh_idx = _swing_high_indices(high, left, right)
    sl_idx = _swing_low_indices(low, left, right)

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

    annotations: list[StructureAnnotation] = []

    # Build ordered list of swing highs with price
    swing_highs: list[tuple[int, float]] = [(int(i), float(high[i])) for i in sh_idx]
    swing_lows: list[tuple[int, float]] = [(int(i), float(low[i])) for i in sl_idx]

    # Label swing highs: HH or HL
    prev_high: float | None = None
    for idx, (bi, px) in enumerate(swing_highs):
        if prev_high is None:
            label = StructureLabel.HH.value
        else:
            label = StructureLabel.HH.value if px > prev_high else StructureLabel.HL.value
        internal = (idx > 0 and idx < len(swing_highs) - 1)
        if internal_only and not internal:
            prev_high = px
            continue
        if external_only and internal:
            prev_high = px
            continue
        annotations.append(StructureAnnotation(
            id=f"swh_{bi}_{hash(px) & 0x7FFFFFFF}",
            type="structure",
            label=label,
            ts=_ts(bi),
            price=px,
            bar_index=bi,
            is_high=True,
            internal=internal,
            metadata={"sequence": idx},
        ))
        prev_high = px

    # Label swing lows: LL or LH
    prev_low: float | None = None
    for idx, (bi, px) in enumerate(swing_lows):
        if prev_low is None:
            label = StructureLabel.LL.value
        else:
            label = StructureLabel.LL.value if px < prev_low else StructureLabel.LH.value
        internal = (idx > 0 and idx < len(swing_lows) - 1)
        if internal_only and not internal:
            prev_low = px
            continue
        if external_only and internal:
            prev_low = px
            continue
        annotations.append(StructureAnnotation(
            id=f"swl_{bi}_{hash(px) & 0x7FFFFFFF}",
            type="structure",
            label=label,
            ts=_ts(bi),
            price=px,
            bar_index=bi,
            is_high=False,
            internal=internal,
            metadata={"sequence": idx},
        ))
        prev_low = px

    # BOS / CHoCH: after each swing, check if price later breaks it
    # BOS bull: price breaks above a swing high (continuation). CHoCH bear: price breaks below swing low after uptrend.
    # Simplified: add BOS when we see a new HH and prior was HL (break above prior high) = BOS_bull.
    # When we see new LL after HL/LH = BOS_bear. When we see LH after HH = CHoCH_bear.
    for i in range(1, len(swing_highs)):
        prev_bi, prev_px = swing_highs[i - 1]
        curr_bi, curr_px = swing_highs[i]
        if curr_px > prev_px:
            annotations.append(StructureAnnotation(
                id=f"bos_bull_{curr_bi}",
                type="structure",
                label=StructureLabel.BOS_BULL.value,
                ts=_ts(curr_bi),
                price=curr_px,
                bar_index=curr_bi,
                is_high=True,
                internal=False,
                metadata={"prior_swing_bar": prev_bi, "prior_price": prev_px},
            ))
        else:
            annotations.append(StructureAnnotation(
                id=f"choch_bear_{curr_bi}",
                type="structure",
                label=StructureLabel.CHOCH_BEAR.value,
                ts=_ts(curr_bi),
                price=curr_px,
                bar_index=curr_bi,
                is_high=True,
                internal=False,
                metadata={"prior_swing_bar": prev_bi, "prior_price": prev_px},
            ))

    for i in range(1, len(swing_lows)):
        prev_bi, prev_px = swing_lows[i - 1]
        curr_bi, curr_px = swing_lows[i]
        if curr_px < prev_px:
            annotations.append(StructureAnnotation(
                id=f"bos_bear_{curr_bi}",
                type="structure",
                label=StructureLabel.BOS_BEAR.value,
                ts=_ts(curr_bi),
                price=curr_px,
                bar_index=curr_bi,
                is_high=False,
                internal=False,
                metadata={"prior_swing_bar": prev_bi, "prior_price": prev_px},
            ))
        else:
            annotations.append(StructureAnnotation(
                id=f"choch_bull_{curr_bi}",
                type="structure",
                label=StructureLabel.CHOCH_BULL.value,
                ts=_ts(curr_bi),
                price=curr_px,
                bar_index=curr_bi,
                is_high=False,
                internal=False,
                metadata={"prior_swing_bar": prev_bi, "prior_price": prev_px},
            ))

    return annotations
