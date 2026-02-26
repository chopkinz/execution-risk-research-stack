# Repo Split Plan

## Target Repositories

- **Repo A**: `execution-risk-research-stack` (flagship orchestrator)
- **Repo B**: `execution-sim-lab`
- **Repo C**: `risk-engine-lab`

The current flagship already includes extraction-ready folders:
- `execution-sim-lab/`
- `risk-engine-lab/`

## Extraction Steps

### 1) Extract Execution Module -> `execution-sim-lab`

Move:
- `src/execution/*`

Add minimal package surface:
- `execution_sim_lab/simulator.py`
- `execution_sim_lab/models.py`

Dependency contract:
- Keep shared dataclasses copied from `src/core/types.py` (or a tiny common package in v2).

### 2) Extract Risk Module -> `risk-engine-lab`

Move:
- `src/risk/*`

Add minimal package surface:
- `risk_engine_lab/engine.py`
- `risk_engine_lab/limits.py`

Dependency contract:
- Keep shared `OrderIntent` and `PortfolioState` dataclasses mirrored from core types.

### 3) Keep Flagship as Orchestrator

Flagship retains:
- `src/backtest`, `src/portfolio`, `src/data`, `src/features`, `src/strategy`, `src/viz`

Then replace local imports:
- `from src.execution...` -> `from execution_sim_lab...`
- `from src.risk...` -> `from risk_engine_lab...`

## Packaging Guidance

- Each extracted repo should include:
  - `pyproject.toml`
  - README
  - tests
  - examples

## Recommended Order

1. Extract execution first (fewer upstream constraints).
2. Extract risk second.
3. Update flagship imports and integration tests.
