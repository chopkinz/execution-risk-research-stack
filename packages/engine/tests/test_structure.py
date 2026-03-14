"""Tests for structure detection: swing highs/lows, HH/HL/LH/LL, BOS/CHoCH."""

from __future__ import annotations

import pandas as pd
import pytest

from engine.signals.structure import detect_structure


def test_structure_empty_returns_empty():
    df = pd.DataFrame(columns=["time", "open", "high", "low", "close"])
    out = detect_structure(df)
    assert out == []


def test_structure_short_returns_empty():
    df = pd.DataFrame({
        "time": pd.date_range("2024-01-01", periods=4, freq="1h", tz="UTC"),
        "open": [100.0] * 4,
        "high": [101.0] * 4,
        "low": [99.0] * 4,
        "close": [100.0] * 4,
    })
    out = detect_structure(df)
    assert out == []


def test_structure_deterministic_with_fixture():
    """Enough bars for at least one swing; output should be deterministic."""
    n = 20
    df = pd.DataFrame({
        "time": pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC"),
        "open": [100.0 + i * 0.1 for i in range(n)],
        "high": [101.0 + i * 0.1 for i in range(n)],
        "low": [99.0 + i * 0.1 for i in range(n)],
        "close": [100.0 + i * 0.1 for i in range(n)],
    })
    out1 = detect_structure(df)
    out2 = detect_structure(df)
    assert len(out1) == len(out2)
    for a1, a2 in zip(out1, out2):
        assert a1.id == a2.id and a1.price == a2.price and a1.bar_index == a2.bar_index


def test_structure_annotations_have_required_fields():
    n = 30
    df = pd.DataFrame({
        "time": pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC"),
        "open": [100.0] * n,
        "high": [101.0] * n,
        "low": [99.0] * n,
        "close": [100.0] * n,
    })
    out = detect_structure(df)
    for a in out[:5]:
        d = a.to_dict()
        assert "id" in d and "type" in d and d["type"] == "structure"
        assert "label" in d and "price" in d and "bar_index" in d
