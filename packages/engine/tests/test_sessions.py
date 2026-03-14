"""Tests for session engine: session levels and DST-safe timezone."""

from __future__ import annotations

import pandas as pd
import pytest

from engine.sessions.engine import SessionConfig, compute_sessions


@pytest.fixture
def ohlc_1d():
    t = pd.date_range("2024-01-02", periods=20, freq="1h", tz="UTC")
    o = [100.0] * 20
    h = [101.0] * 20
    l = [99.0] * 20
    c = [100.0] * 20
    return pd.DataFrame({"time": t, "open": o, "high": h, "low": l, "close": c})


def test_compute_sessions_returns_list(ohlc_1d):
    out = compute_sessions(ohlc_1d)
    assert isinstance(out, list)


def test_session_annotation_has_required_fields(ohlc_1d):
    out = compute_sessions(ohlc_1d)
    for a in out[:3]:
        d = a.to_dict()
        assert "id" in d and "name" in d
        assert "high" in d and "low" in d and "range" in d and "midpoint" in d


def test_session_config_default_tz():
    cfg = SessionConfig()
    assert cfg.timezone == "America/Chicago"


def test_compute_sessions_empty_returns_empty():
    empty = pd.DataFrame(columns=["time", "open", "high", "low", "close"])
    out = compute_sessions(empty)
    assert out == []


def test_compute_sessions_no_time_column_returns_empty():
    df = pd.DataFrame({"open": [100.0], "high": [101.0], "low": [99.0], "close": [100.0]})
    out = compute_sessions(df)
    assert out == []
