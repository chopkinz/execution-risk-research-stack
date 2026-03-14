# Meridian CLI

## Overview

The Meridian CLI provides the same workflows as the web app from the terminal: data fetch, session summaries, annotation generation, simulation (backtest), and report inspection. Same configs and artifact layout; output uses Rich for tables and panels. Suitable for SSH or phone terminal use.

## Entry Point

With the engine installed (e.g. `pip install -e packages/engine` from repo root with `PYTHONPATH=packages/engine/src` or after `make install`):

```bash
meridian <command> [options]
```

Commands: `data`, `sessions`, `annotate`, `simulate`, `report`.

## Commands

### meridian data

Fetch OHLCV data (Yahoo) and optionally write `ohlcv.csv` to a directory.

```bash
meridian data --symbol ^NDX --interval 15m --period 60d
meridian data --symbol NAS100 --interval 15m --period 60d --out ./my_run
meridian data --symbol SPY --refresh
```

- `--symbol`: Symbol or preset name (default `^NDX`).
- `--interval`: e.g. `1m`, `5m`, `15m`, `1h`, `1d`.
- `--period`: e.g. `5d`, `60d` (ignored if start/end provided).
- `--refresh`: Bypass cache and re-download.
- `--out`: If set, write `ohlcv.csv` to this directory.
- `--root`: Repo/package root for cache dir (default: engine package root).

Output: Rich table with row count, symbol, interval, first/last timestamp.

### meridian sessions

Print session summaries (Asia/London/NY highs and lows, FVGs, sweeps) for given symbols. Same logic as the web Terminal and session API.

```bash
meridian sessions
meridian sessions QQQ SPY GLD
```

Uses the existing `meridian-session` implementation (session_cli). Symbols default to QQQ, SPY if omitted.

### meridian annotate

Run the annotation engine (FVG, market structure, sessions) on data loaded from a config and write `annotations.json`.

```bash
meridian annotate --config packages/engine/configs/nas100_momentum.yaml
meridian annotate --config ./my_config.yaml --out ./outputs/annotate
```

- `--config`: Path to run config (YAML or JSON) used to load symbol/interval/period.
- `--out`: Output directory (default: `outputs/annotate` under config parent).
- `--root`: Root for data cache (default: config file parent).

Output: Rich table of annotation counts and path to `annotations.json`.

### meridian simulate

Run a full backtest from a config file. Same pipeline as the web “Run Simulation” (strategy → risk → execution → metrics and artifacts).

```bash
meridian simulate --config packages/engine/configs/nas100_momentum.yaml
meridian simulate --config ./config.yaml --out apps/web/public/research/latest --root .
```

- `--config`: Path to run config (YAML or JSON).
- `--out`: Artifact output directory (default: `outputs/simulate` under root).
- `--root`: Repo root for data and cache (default: config parent).

Output: Metrics panel and path to artifact directory (summary.json, trades.csv, equity curve, etc.).

### meridian report

Print a summary of a completed run from a directory that contains `summary.json`.

```bash
meridian report --dir apps/web/public/research/latest
meridian report --dir /tmp/my_run
```

- `--dir`: Run directory (must contain `summary.json`).

Output: Rich panel with run_id, instrument, timeframe, trades, win rate, drawdown, risk/execution config, etc.

## Config Files

Same format as the web. Configs live under `packages/engine/configs/` (e.g. `nas100_momentum.yaml`, `session_breakout.yaml`, `fvg_retracement.yaml`). You can pass any path to `--config`. JSON is supported as well as YAML.

## Artifact Bundle

After `meridian simulate` (or a web run), the output dir contains the same bundle as documented in ARCHITECTURE.md: `summary.json`, `metrics.json`, `trades.csv`, `equity_curve.csv`, `drawdown.csv`, `ohlcv.csv`, `annotations.json`, `risk_log.json`, `risk_rejections.csv`, `report.md`, `report.html`, and PNGs. Use `meridian report --dir <path>` to inspect `summary.json` quickly.

## Failure Cases

- **Config not found**: `--config` path missing → exit with message.
- **No data**: Symbol preset or Yahoo returns no data → error and exit.
- **Missing summary.json**: `meridian report --dir <path>` when `summary.json` is missing → error and exit.
