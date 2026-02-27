# Meridian Terminal

Meridian Terminal is a single self-contained product with:

- `apps/web`: Next.js App Router + TypeScript + Tailwind + Bun UI
- `packages/engine`: unified Python execution/risk/backtest/reporting engine

No external repo is required for core functionality. The web app runs the local Python engine and renders artifacts produced inside this repository.

## Monorepo Layout

```text
.
├── apps/
│   └── web/
├── packages/
│   └── engine/
├── Makefile
└── .github/workflows/ci.yml
```

## Research Runtime

Web API routes in `apps/web`:

- `POST /api/research/run`
  - runs the engine demo and writes artifacts to `apps/web/public/research/latest`
  - streams engine logs over SSE
- `GET /api/research/status`
  - reports artifact readiness and latest run timestamp
- `GET /api/session?symbols=QQQ,SPY`
  - returns session high/low, open/close, volume, and pattern for use by the Terminal view or other clients.

## Artifact Contract

Engine writes directly into `apps/web/public/research/latest/`:

- `summary.json`
- `equity_curve.png`
- `drawdown.png`
- `risk_rejections.png`
- `report.md`
- optional: `monte_carlo_dd.png`

`/research` renders run metadata, artifacts, markdown report, and streaming run logs.

## One-Command Dev Experience

```bash
make install
make dev
```

Additional targets:

- `make run` -> generate latest research artifacts (full backtest)
- `make backtest` -> same as make run (full backtest, writes to web public)
- `make session` -> run session CLI (highs, lows, patterns) in terminal
- `make test` -> run Python engine tests
- `make verify` -> run engine + tests + web lint/build verification

## Terminal & Session CLI

**Web:** Open **Terminal** in the app (or `/terminal`) for a mobile-friendly view: session high/low, open/close, change%, volume, and pattern (HH/HL, LH/LL, etc.) for QQQ, SPY, GLD, UUP. Auto-refreshes every minute.

**Real terminal (e.g. from phone over SSH):**

```bash
# Session (highs, lows, patterns)
make session
# Or with symbols:
PYTHONPATH=packages/engine/src packages/engine/.venv/bin/python -m engine.scripts.session_cli QQQ SPY GLD

# Full backtest (strategy → risk → execution), prints summary to terminal
PYTHONPATH=packages/engine/src packages/engine/.venv/bin/python -m engine.scripts.backtest_cli --out apps/web/public/research/latest
# Or if installed via pip:
meridian-backtest --out apps/web/public/research/latest
```

Shows session highs, lows, patterns, and a tiny ASCII chart. Use any terminal (Termius, Blink, iSH, etc.) to SSH into a box that has the repo and run the above for morning trading. Run `meridian-backtest` (or the python -m command) to execute the full backtest and see the summary in the terminal; use `--out apps/web/public/research/latest` so the web app shows the same run under Research and Terminal.

## Termius (SSH from phone)

See **[docs/TERMIUS_SSH.md](docs/TERMIUS_SSH.md)** for enabling SSH and connecting with Termius. From repo root run `./scripts/termius-info.sh` to print your Host, User, Port and the exact path to use after login.

## Environment

- Optional: set `RUN_ENGINE=true` if you want to restrict engine execution to certain environments (by default the run endpoint allows execution).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs:

- Python dependency install
- engine test suite
- fast engine smoke run that writes web artifacts
- Bun install + web verify (`lint` + `build`)
