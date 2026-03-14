# Meridian Terminal — Architecture

## Overview

Meridian Terminal is a monorepo containing:

- **apps/web**: Next.js App Router UI (Markets, Terminal, Research, Simulation Lab).
- **packages/engine**: Python execution/risk/backtest/annotations engine.

The web app triggers engine runs (demo or configurable simulation) and displays artifacts written to `apps/web/public/research/latest/`.

## Engine Lifecycle

1. **Data**: Load OHLCV (Yahoo or other provider), normalize to `time, open, high, low, close, volume`.
2. **Annotations**: Run FVG engine, session engine, market structure layer; write `annotations.json`.
3. **Features**: Add Chicago time, momentum, session box, air-pocket (FVG) flags, session mask.
4. **Strategy**: `prepare(features_df)` then per-bar `on_bar(row, features, state)` → `OrderIntent[]`.
5. **Risk**: Each intent evaluated by risk engine (position size, daily/weekly loss, drawdown, exposure, etc.); rejections logged to `risk_log.json` and `risk_rejections.csv`.
6. **Execution**: Approved intents simulated (spread, slippage, latency, fees); `Fill` records include `expected_price` for audit.
7. **Portfolio**: `apply_fills` updates cash, positions, equity, drawdown, daily/weekly PnL.
8. **Output**: Trades, equity curve, metrics, Monte Carlo, report, summary, PNGs.

## Artifact Contract

Each run writes to the output directory (e.g. `public/research/latest/`):

| File | Description |
|------|-------------|
| `run_id.txt` | Deterministic run id (hash of config + data fingerprint). |
| `summary.json` | Run metadata for UI: instrument, timeframe, trades, win_rate, max_drawdown_pct, etc. |
| `metrics.json` | Full metrics dict. |
| `trades.csv` | Trade list (time, symbol, direction, qty, entry/exit price, pnl, fees, slippage). |
| `equity_curve.csv` | Time, date, equity, drawdown_pct. |
| `ohlcv.csv` | Input OHLCV snapshot. |
| `annotations.json` | FVG, structure, session annotations for chart overlays. |
| `risk_log.json` | Run id + list of risk rejections. |
| `risk_rejections.csv` | Same rejections in CSV form. |
| `report.md` | Markdown tear sheet. |
| `equity_curve.png`, `drawdown.png`, `risk_rejections.png` | Charts. |
| `montecarlo.csv` | Monte Carlo resample results. |

## Config Model

Configs are YAML or JSON with:

- `symbol`, `interval`, `period` (or `start`/`end`) for data.
- `session.start`, `session.end` for in-session filter.
- `portfolio.initial_cash`.
- `risk`: limits (max_position_size, max_trades_per_day, max_daily_loss_pct, max_drawdown_pct, max_gross_exposure, optional max_weekly_loss_pct, max_open_positions).
- `execution`: spread_bps, min_spread, slippage_k, delay_bars, fee_bps.
- `strategy`: `name` (momentum | session_breakout | fvg_retracement) and strategy-specific params.

## Data Flow

- **Research “Run Latest Backtest”**: Runs `engine.scripts.demo` (synthetic data) → writes to `public/research/latest/`.
- **Simulation Lab “Run Simulation”**: POST `/api/simulate` with `{ symbol, interval, period, strategy }` → writes `run_config.json` → runs `engine.scripts.run_config` → streams logs, writes same artifact set to `public/research/latest/`.

## Failure Cases / Caveats

- Engine must be installed (venv at `packages/engine/.venv`) and `PYTHONPATH` set to `packages/engine/src` when running from API.
- Yahoo data: rate limits and symbol availability vary; futures/forex symbols may differ (e.g. NQ=F, EURUSD=X).
- Single “latest” output dir: no run history persistence yet; each run overwrites.
- Chart overlays: annotations are produced and stored; a chart component that loads `annotations.json` and draws FVG/session/structure is optional next step.
