# execution-risk-research-stack

Institutional-grade, execution-aware, risk-first systematic trading research infrastructure.

## Repository network

- Flagship (this repo): `https://github.com/chopkinz/execution-risk-research-stack`
- Execution module: `https://github.com/chopkinz/execution-sim-lab`
- Risk module: `https://github.com/chopkinz/risk-engine-lab`

## Core principles

- Deterministic runs (fixed seed, config-driven).
- Risk-first architecture:
  `Strategy -> OrderIntent -> RiskEngine -> ExecutionSimulator -> Portfolio -> Metrics`
- Execution-aware fills:
  spread + slippage + latency + fees.
- No lookahead in feature pipeline.

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run backtest:

```bash
python scripts/run_backtest.py --config configs/nas100_momentum.yaml
```

Run walkforward:

```bash
python scripts/run_walkforward.py --config configs/nas100_momentum.yaml --train-ratio 0.7
```

Run sweep:

```bash
python scripts/run_sweep.py --base-config configs/nas100_momentum.yaml --prefer-high-win-rate
```

Build/open app:

```bash
streamlit run app.py
```

## Project layout

```text
docs/
src/
  core/
  data/
  features/
  strategy/
  risk/
  execution/
  portfolio/
  backtest/
  viz/
scripts/
configs/
tests/
```

## Current limitations

See:

- `docs/limitations.md`
- `docs/roadmap.md`

## Repo split plan

See `docs/repo_split_plan.md` for extraction path into:

- execution-sim-lab
- risk-engine-lab

Extraction-ready local folders are already included:

- `execution-sim-lab/`
- `risk-engine-lab/`

## Release cadence

- Initial baseline release tag: `v0.1.0`
- Flagship is the integration/orchestration surface.
- Module repos can be versioned independently after extraction hardening.
