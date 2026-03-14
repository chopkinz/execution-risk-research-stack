"""Tests for FVG detection and fill state transitions."""

from __future__ import annotations

import pandas as pd
import pytest

from engine.signals.fvg import (
    FVGConfig,
    FVGEngine,
    FVGStatus,
    detect_fvgs,
    FillMethod,
)


@pytest.fixture
def simple_ohlc():
    n = 50
    t = pd.date_range("2024-01-01", periods=n, freq="15min", tz="UTC")
    # Create a clear bullish FVG at bar 10: high[9] < low[11]
    o = [100.0 + i * 0.1 for i in range(n)]
    h = [o[i] + 0.5 for i in range(n)]
    l = [o[i] - 0.5 for i in range(n)]
    c = [o[i] for i in range(n)]
    h[9], l[9] = 100.9, 100.4
    h[10], l[10] = 101.5, 101.0
    h[11], l[11] = 102.1, 101.8  # low[11]=101.8 > high[9]=100.9 -> bullish FVG
    return pd.DataFrame({"time": t, "open": o, "high": h, "low": l, "close": c})


def test_detect_bullish_fvg(simple_ohlc):
    fvgs = detect_fvgs(simple_ohlc)
    bullish = [f for f in fvgs if f.direction == "bullish"]
    assert len(bullish) >= 1
    one = bullish[0]
    assert one.upper > one.lower
    assert one.size == one.upper - one.lower
    assert one.status == FVGStatus.CREATED
    assert one.bar_index == 10


def test_detect_fvg_min_gap_filter(simple_ohlc):
    fvgs = detect_fvgs(simple_ohlc, min_gap_absolute=100.0)
    assert len(fvgs) == 0


def test_fvg_engine_update_fill(simple_ohlc):
    engine = FVGEngine(FVGConfig(fill_method=FillMethod.TOUCH))
    fvgs = engine.detect(simple_ohlc)
    assert len(fvgs) >= 1
    updated = engine.update_fill_states(fvgs, simple_ohlc)
    for u in updated:
        assert u.fill_percent >= 0 and u.fill_percent <= 1.0
        assert u.status in (FVGStatus.CREATED, FVGStatus.STILL_OPEN, FVGStatus.PARTIALLY_FILLED, FVGStatus.FULLY_FILLED)


def test_fvg_annotation_to_dict(simple_ohlc):
    fvgs = detect_fvgs(simple_ohlc)
    if not fvgs:
        pytest.skip("no FVGs in fixture")
    d = fvgs[0].to_dict()
    assert d["type"] == "fvg"
    assert "upper" in d and "lower" in d and "score" in d
