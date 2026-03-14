# Data Providers

## Overview

The engine uses a **provider abstraction** so that OHLCV data can come from Yahoo (yfinance), and later from Polygon, OANDA, Dukascopy, etc., with a single normalized schema: `time`, `open`, `high`, `low`, `close`, `volume`.

## Current Implementation

- **Yahoo (yfinance)**  
  Implemented in `packages/engine/src/engine/data/loaders.py` and `engine/data/providers.py`.  
  All timestamps are normalized to UTC.  
  Cache is per-request (symbol + interval + period) in parquet under the engine data dir.

## Symbol Presets

Logical symbols are resolved to one or more provider-specific symbols; the first successful fetch is used.

| Logical   | Tried in order        | Notes                    |
|-----------|------------------------|--------------------------|
| NAS100    | NQ=F, ^NDX            | Futures then index       |
| NDX       | ^NDX, NQ=F            | Index then futures       |
| XAUUSD    | GC=F, XAUUSD=X        | Gold futures / forex     |
| GOLD      | GC=F, XAUUSD=X        | Same as XAUUSD           |
| EURUSD    | EURUSD=X               | Forex                    |
| GBPUSD    | GBPUSD=X               | Forex                    |
| USDJPY    | USDJPY=X               | Forex                    |
| SPY, QQQ, GLD, UUP | As-is | Single symbol        |

Config can use either a logical name (e.g. `symbol: NAS100`) or a direct symbol (e.g. `symbol: ^NDX`). When the symbol is in `SYMBOL_PRESETS`, `load_data_from_config` uses `load_with_preset` and tries each alias until one returns data.

## Config

In your run config (YAML/JSON):

```yaml
symbol: NAS100   # or ^NDX, NQ=F, SPY, etc.
interval: "15m"
period: "60d"
```

No separate “provider” field is required for Yahoo; it is the default. Future providers can be selected by a `provider` key and/or different symbol formats.

## Limitations (Yahoo)

- **Rate limits**: Heavy or parallel use can be throttled.
- **Delays**: Futures/forex may be delayed; equities vary by exchange.
- **Availability**: Some tickers (e.g. certain futures or forex pairs) may be missing or differ by region.
- **Quality**: Single feed; no official NBBO or multi-venue depth.

When higher-fidelity data (e.g. Polygon, OANDA) is not available, that should be surfaced in UI/docs so users know they are viewing Yahoo-backed data.

## Extension

To add another provider:

1. In `engine/data/providers.py` (or a new module), implement a loader that returns a DataFrame with columns: `time`, `open`, `high`, `low`, `close`, `volume` (and optional `volume`), with `time` UTC.
2. Add a branch in `load_data_from_config` (or a small router) that selects provider from config and calls the right loader.
3. Optionally extend symbol presets with provider-specific symbols for the new source.

## Failure Cases

- **No data**: All aliases for a preset fail → `ValueError` with “No data for X (tried […])”.
- **Empty series**: Normalizer raises if the downloaded DataFrame is empty after basic cleaning.
- **Missing columns**: Renames expect at least Open/High/Low/Close (and Volume if present); otherwise normalization can fail.
