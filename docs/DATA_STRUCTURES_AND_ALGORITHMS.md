# Data Structures and Algorithms

This document describes the core data structures and algorithmic choices in the engine for correctness, performance, and maintainability.

## Core domain models

All normalized types live in `engine.core.models` and `engine.core.types`:

| Type | Module | Purpose |
|------|--------|---------|
| **Bar** | models | Single OHLCV bar; immutable view for the event-driven loop. Built via `Bar.from_series(row)` in O(1). |
| **Annotation** | models | Protocol for chart/strategy annotations (FVG, session, structure). Requires `id`, `type`, `to_dict()`. |
| **OrderIntent** | types | Strategy output: symbol, side, qty, order_type, timestamp, bar_index. Consumed by risk then execution. |
| **Fill** | types | Execution result: symbol, side, qty, fill_price, fees, slippage, timestamp, bar_index. |
| **Position** | types | Per-symbol position state: qty, avg_price, realized_pnl, unrealized_pnl. |
| **PortfolioState** | types | Aggregated state: cash, equity, positions, exposure, daily_pnl, weekly_pnl, peak_equity, drawdown_pct. |
| **RiskDecision** | types | Risk gate output: approved, reasons, adjusted_qty. |
| **RiskEvent** | models | Single rejection for audit: time, symbol, reason, bar_index. Collected in backtest and written to risk_log/risk_rejections. |
| **RunArtifact** | models | Description of one output file (path, kind, description) for API listing. |

Pandas is used only where it is the best fit: OHLCV series, equity curves, trade tables, and reporting. The event loop uses `Bar` and typed containers (list of OrderIntent, list of Fill, list of RiskEvent) rather than row-wise dicts.

## Backtest engine layers

The simulation is deterministic and event-driven. Layers are separated so each can be tested independently:

1. **Data ingestion** — Load OHLCV (e.g. Yahoo, config), normalize schema. Output: single DataFrame.
2. **Annotation generation** — FVG, sessions, structure run over the same data (parallel or sequential). Output: annotations.json.
3. **Features** — `build_features()` adds time, momentum, session mask, FVG flags. Output: features DataFrame.
4. **Strategy** — `prepare(feats)` once; `on_bar(bar, features, state)` per bar; `finalize()`. Output: list of OrderIntent per bar.
5. **Risk filtering** — Each intent is evaluated; rejections become RiskEvents. Output: approved intents.
6. **Execution simulation** — Approved intents → fills (spread, slippage, latency, fees). Output: list of Fill.
7. **Portfolio accounting** — `apply_fills()` updates positions, cash, equity, drawdown. Output: new PortfolioState.
8. **Reporting** — Metrics, report files, summary.json, PNGs. Output: RunArtifact set (implicit).

## Algorithmic complexity

| Component | Complexity | Notes |
|----------|------------|--------|
| Session computation | O(n) bucket fill + O(k) aggregate | Single pass over rows; no groupby, no per-column apply. Buckets keyed by (date_ct, session_name) and date_ct. |
| FVG detection | O(n) | Single pass over bar index 1..n-2; ATR vectorized once; merge step O(f) where f = number of FVGs. |
| FVG fill update | O(f × b) | Per-FVG loop over bars after bar_index; necessary for event-driven fill state. |
| Structure (swing H/L) | O(n) | Vectorized via sliding_window_view; local max/min in one pass. |
| Backtest loop | O(n) | One Bar and one strategy.on_bar per bar; risk/execution/accounting O(1) per intent/fill. |
| Metrics | O(t + e) | Columnar ops on trades and equity DataFrames. |

## Memory and serialization

- **No duplicate full-series copies** in the hot path: features DataFrame is built once; Bar is built per bar from a row view.
- **Rejection and trade rows** are accumulated in lists and converted to DataFrame once at the end.
- **Artifacts**: CSV for downloads and compatibility; JSON for summary and annotations. Parquet can be added for large internal series if needed.
- **Chart annotations**: annotations.json is kept compact (id, type, minimal fields); frontend can request it once and cache.

## API and web

- Research status API returns only readiness flags and missing list, not full file contents.
- Heavy visualizations are precomputed (equity_curve.png, drawdown.png, etc.); frontend loads images by URL.
- Simulation API streams logs and returns a short message; full artifacts are read from disk by the Research page.

## Testing

- **Correctness**: Fixture-based tests for sessions (required fields, DST-safe, empty/no-time), FVG (detect, filter, fill state), structure (empty, short, deterministic), core models (Bar, RiskEvent, Annotation protocol), accounting, risk gates.
- **Edge cases**: Empty data, single bar, sparse data, duplicate timestamps, DST transitions, missing bars, overlapping sessions.
- **Determinism**: Same config + data → same run_id and outputs; tests use fixed seeds and fixtures.
- **Performance sanity**: Critical paths (session compute, structure detect) can be benchmarked on large n; no naive O(n²) in hot paths.

## Performance review (implemented)

- **Backtest loop**: Single pass over features; Bar.from_series(row) is O(1); no full DataFrame copy inside the loop.
- **Sessions**: No groupby; single pass with dict buckets; aggregation over unique keys only.
- **Structure**: Swing indices via numpy sliding_window_view; no Python loop over window elements.
- **FVG**: One pass over bar index; ATR computed once; fill-state update is per-FVG (unavoidable for event-driven semantics).
- **API**: Research status returns only ready/missing/lastRunAtUtc; no large payloads. Chart data is precomputed files (PNG/JSON).
