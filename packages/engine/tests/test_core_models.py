"""Tests for core domain models: Bar, RiskEvent, Annotation protocol."""

from __future__ import annotations

import pandas as pd
import pytest

from engine.core.models import Bar, RiskEvent


def test_bar_from_series():
    row = pd.Series({
        "time": pd.Timestamp("2024-01-01 10:00", tz="UTC"),
        "open": 100.0,
        "high": 101.0,
        "low": 99.0,
        "close": 100.5,
        "volume": 1000.0,
        "bar_index": 42,
    })
    bar = Bar.from_series(row, symbol="X", bar_index=42)
    assert bar.symbol == "X"
    assert bar.bar_index == 42
    assert bar.close == 100.5
    assert bar.high == 101.0
    assert bar.open == 100.0
    assert bar.low == 99.0
    assert bar.volume == 1000.0


def test_bar_from_series_uses_bar_index_from_row():
    row = pd.Series({
        "time": pd.Timestamp("2024-01-01", tz="UTC"),
        "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5,
        "bar_index": 10,
    })
    bar = Bar.from_series(row, symbol="Y")
    assert bar.bar_index == 10


def test_bar_immutable():
    bar = Bar(
        symbol="Z",
        bar_index=0,
        time=pd.Timestamp.now(tz="UTC"),
        open=1.0, high=2.0, low=0.5, close=1.5,
    )
    with pytest.raises(AttributeError):
        bar.close = 2.0  # type: ignore[misc]


def test_risk_event_to_dict():
    ts = pd.Timestamp("2024-01-01 12:00", tz="UTC")
    e = RiskEvent(time=ts, symbol="X", reason="max_position", bar_index=5)
    d = e.to_dict()
    assert d["symbol"] == "X"
    assert d["reason"] == "max_position"
    assert d["bar_index"] == 5
    assert "time" in d


def test_fvg_annotation_satisfies_protocol():
    """FVGAnnotation has id, type, to_dict — satisfies Annotation protocol."""
    from engine.signals.fvg import FVGAnnotation, FVGStatus
    import pandas as pd
    a = FVGAnnotation(
        id="fvg_1",
        direction="bullish",
        start_ts=pd.Timestamp.now(tz="UTC"),
        end_ts=pd.Timestamp.now(tz="UTC"),
        upper=101.0,
        lower=99.0,
        midpoint=100.0,
        size=2.0,
        size_ticks=200.0,
        atr_multiple=0.5,
        status=FVGStatus.CREATED,
        fill_percent=0.0,
        score=1.0,
        bar_index=10,
    )
    assert a.id == "fvg_1"
    assert a.type == "fvg"
    d = a.to_dict()
    assert d["id"] == "fvg_1" and d["type"] == "fvg"
