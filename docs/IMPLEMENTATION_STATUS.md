# Meridian Terminal — Implementation Status

Running checklist for the full execution + risk research platform implementation.

## Phase 1 — Annotations + Market Structure Engine

| Item | Status | Notes |
|------|--------|--------|
| FVG engine (`packages/engine/src/engine/signals/fvg.py`) | Done | Configurable detection, lifecycle, fill logic, scoring |
| Session engine (`packages/engine/src/engine/sessions/`) | Done | America/Chicago, Asia/London/NY, DST, configurable |
| Market structure layer (`engine/signals/structure.py`) | Done | Swing HH/HL/LH/LL, BOS, CHoCH annotations |

## Phase 2 — Simulation Lab

| Item | Status | Notes |
|------|--------|--------|
| Strategy runtime interface (prepare/on_bar/finalize) | Done | engine.strategy.base + strategies |
| Session breakout / FVG retracement / momentum strategies | Done | engine.strategies + configs |
| Event-driven simulation core | Done | run_backtest: run_id, annotations, risk_log, summary.json |
| Risk engine expansion | Done | MaxWeeklyLoss, MaxOpenPositions; weekly_pnl in state |
| Execution engine | Done | expected_price on Fill; spread/slippage/latency/fees |

## Phase 3 — App Integration

| Item | Status | Notes |
|------|--------|--------|
| Simulation lab page fully functional | Done | /simulation: symbol, interval, period, strategy; POST /api/simulate; stream logs; summary |
| Chart terminal with real overlays | Partial | annotations.json written per run; chart can load /research/latest/annotations.json |
| Run history & persistence | Pending | Single latest dir; run_id in summary/run_id.txt |

## Phase 4 — Exports / Artifacts

| Item | Status | Notes |
|------|--------|--------|
| summary.json, metrics.json, trades.csv, ohlcv.csv | Done | Written by run_backtest |
| annotations.json, risk_log.json, equity_curve.csv, drawdown.csv | Done | drawdown.csv + report.html in build_report |
| report.md, report.html, PNG charts | Done | report.md + report.html + equity/drawdown/risk_rejections.png |
| Downloadable from UI | Done | Research + Simulation Lab have download links for all artifacts |

## Phase 5 — Data Providers

| Item | Status | Notes |
|------|--------|--------|
| Yahoo provider (yfinance), normalized schema | Done | engine.data.loaders |
| Symbol presets (NAS100, XAUUSD, EURUSD, etc.) | Done | engine.data.providers SYMBOL_PRESETS, load_with_preset |
| Extension points (Polygon, OANDA, Dukascopy) | Partial | Same interface; add providers in data/providers.py |

## Phase 6 — CLI Parity

| Item | Status | Notes |
|------|--------|--------|
| meridian data / sessions / annotate / simulate / report | Done | engine.scripts.meridian_cli, same configs, Rich output |

## Phase 7 — Documentation

| Item | Status | Notes |
|------|--------|--------|
| Root README update | Done | Artifact contract, Simulation Lab, deploy links |
| docs/ARCHITECTURE.md | Done | Lifecycle, artifact contract, config, data flow |
| docs/DATA_STRUCTURES_AND_ALGORITHMS.md | Done | Core models, layers, complexity, memory, testing |
| docs/DATA_PROVIDERS.md, CLI.md, FVG.md, SESSIONS.md | In progress | |

## Phase 8 — Tests

| Item | Status | Notes |
|------|--------|--------|
| FVG detection, fill state transitions | Done | test_fvg.py |
| Session highs/lows, DST | Done | test_sessions.py |
| Market structure, strategy determinism, risk gates, slippage, artifacts, API | Partial | Add as needed |

---

## Audit — No fake depth

Meridian is intended to feel like a real platform: every UI element should reflect real behavior. The following gaps were identified and fixed so the UI does not overstate capability.

| Gap | User saw | Reality | Fix |
|-----|----------|---------|-----|
| Run source tabs (Unified / Risk Lab / Execution Sim Lab) | Three run sources with full artifact sets per source | Only the unified run writes the full artifact set; Risk Lab / Execution Lab subdirs lack equity/drawdown/risk_rejections PNGs → 404s and placeholder metadata | Removed Risk Lab and Execution Sim Lab as run sources. Research page shows a single unified view only. Optional lab reports can be linked later if those artifacts are produced. |
| Run metadata “Risk Constraints” | Daily Loss %, Exposure %, Kill Switch % | Engine wrote `risk.max_gross_exposure` and `risk.max_drawdown_pct`; UI expected `max_exposure_pct` and `kill_switch_drawdown_pct` → undefined/broken display | Engine `summary.json` now includes `max_exposure_pct` (from max_gross_exposure / initial_cash) and `kill_switch_drawdown_pct` (same as config limit). UI Summary type and display accept both shapes. |
| Artifact tabs (Overview / Risk / Execution / Robustness) | Four tabs implying distinct views | “Risk” showed drawdown, “Execution” showed risk rejections (mislabeled). Robustness pointed to `monte_carlo_dd.png` which only the demo script wrote → 404 after Simulation Lab runs | Tabs renamed to Equity, Drawdown, Risk rejections, Monte Carlo. `build_report()` now generates `monte_carlo_dd.png` from `montecarlo.csv` when present. Tab content shows a clear placeholder message when the image is missing (e.g. no Monte Carlo run). |

**Principles**

- Do not present multiple “run sources” unless each has a full, generated artifact set.
- Align backend summary shape with what the UI displays (e.g. `summary.risk`).
- Generate all artifact images in the main report path (e.g. `monte_carlo_dd.png` in `build_report`) so Simulation Lab and demo both produce the same set.
- Label tabs by content (Equity, Drawdown, Risk rejections, Monte Carlo) and handle missing assets with an explicit message instead of a broken image.

---

## Data structures and algorithms

Engine is normalized around typed domain models and clear layers:

- **Core models** (`engine.core.models`): Bar (immutable OHLCV view), Annotation protocol, RiskEvent, RunArtifact. Types in `engine.core.types`: OrderIntent, Fill, Position, PortfolioState, RiskDecision, BacktestResult.
- **Strategy interface**: `on_bar(bar: Bar, features: pd.Series, portfolio_state) -> list[OrderIntent]`. Event-driven; one Bar per step.
- **Sessions**: Single-pass bucket fill O(n), no groupby, no per-column apply.
- **Structure**: Vectorized swing high/low via sliding_window_view O(n).
- **Backtest**: Rejections collected as RiskEvent; artifacts written from typed structures.

See **docs/DATA_STRUCTURES_AND_ALGORITHMS.md** for complexity, memory, and testing notes.

---

*Last updated: implementation start; audit section added after no-fake-depth pass; data structures and algorithms section added.*
