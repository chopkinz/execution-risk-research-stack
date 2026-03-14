"""Tests for data provider abstraction and symbol presets."""

from __future__ import annotations

from pathlib import Path

import pytest

from engine.data.providers import SYMBOL_PRESETS, resolve_symbol


def test_resolve_symbol_preset():
    assert resolve_symbol("NAS100") == "NQ=F"
    assert resolve_symbol("SPY") == "SPY"
    assert resolve_symbol("EURUSD") == "EURUSD=X"


def test_resolve_symbol_passthrough():
    assert resolve_symbol("^NDX") == "^NDX"
    assert resolve_symbol("NQ=F") == "NQ=F"


def test_symbol_presets_contain_expected():
    assert "NAS100" in SYMBOL_PRESETS
    assert "XAUUSD" in SYMBOL_PRESETS
    assert "SPY" in SYMBOL_PRESETS
    assert len(SYMBOL_PRESETS["NAS100"]) >= 2  # fallback list
