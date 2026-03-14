"""
Data provider abstraction with normalized schema and symbol presets.

Current implementation: Yahoo (yfinance) only. Designed for future extension
(Polygon, OANDA, Dukascopy) via a common OHLCV interface.

Symbol presets resolve logical names to provider-specific symbols with fallbacks.
Limitations: Yahoo has rate limits; futures/forex may have different tickers
and delayed data; document in UI/docs when higher fidelity is not available.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from engine.data.loaders import YahooRequest, load_yahoo

# Symbol presets: logical name -> list of yfinance symbols to try (first success wins)
# NAS100 -> NQ=F (futures) fallback ^NDX (index)
# XAUUSD -> GC=F (futures) fallback XAUUSD=X (forex)
SYMBOL_PRESETS: dict[str, list[str]] = {
    "NAS100": ["NQ=F", "^NDX"],
    "NDX": ["^NDX", "NQ=F"],
    "XAUUSD": ["GC=F", "XAUUSD=X"],
    "GOLD": ["GC=F", "XAUUSD=X"],
    "EURUSD": ["EURUSD=X"],
    "GBPUSD": ["GBPUSD=X"],
    "USDJPY": ["USDJPY=X"],
    "SPY": ["SPY"],
    "QQQ": ["QQQ"],
    "GLD": ["GLD"],
    "UUP": ["UUP"],
}


def resolve_symbol(symbol: str) -> str:
    """
    Resolve a logical symbol to a single yfinance symbol.
    If the symbol is a preset name (e.g. NAS100), returns the first in the list.
    Otherwise returns the symbol as-is (e.g. ^NDX, NQ=F).
    """
    s = symbol.strip().upper()
    if s in SYMBOL_PRESETS:
        return SYMBOL_PRESETS[s][0]
    return symbol


def load_with_preset(
    symbol: str,
    interval: str,
    period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    cache_dir: Path | None = None,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Load OHLCV using symbol presets: try each alias until one returns data.
    Returns normalized DataFrame with columns: time, open, high, low, close, volume.
    Raises ValueError if no alias returns data.
    """
    candidates = SYMBOL_PRESETS.get(symbol.strip().upper(), [symbol])
    if not isinstance(candidates, list):
        candidates = [candidates]
    last_err: Exception | None = None
    for sym in candidates:
        try:
            req = YahooRequest(
                symbol=sym,
                interval=interval,
                period=period,
                start=start,
                end=end,
                force_refresh=force_refresh,
            )
            if cache_dir is None:
                import tempfile
                cache_dir = Path(tempfile.gettempdir()) / "meridian_data"
            return load_yahoo(req, cache_dir)
        except Exception as e:
            last_err = e
            continue
    raise ValueError(f"No data for {symbol} (tried {candidates}): {last_err}")
