# risk-engine-lab

Risk approval engine for systematic trading workflows with explicit reject reasons and guardrails.

## Context

`risk-engine-lab` is the risk layer extracted from the flagship stack:

- Source integration repo: `https://github.com/chopkinz/execution-risk-research-stack`
- Sibling execution module: `https://github.com/chopkinz/execution-sim-lab`

It is designed as a pluggable gate between strategy intent and execution.

## Risk-First Model

Expected flow:

`Strategy -> OrderIntent -> RiskEngine -> RiskDecision -> Execution`

The risk engine does not execute orders.  
It only approves/rejects (and optionally adjusts) order intents based on configured limits.

## Included Limits

- `MaxPositionSize`
- `MaxTradesPerDay`
- `MaxDailyLoss`
- `MaxDrawdown`
- `MaxGrossExposure`

## Kill Switch

Engine-level kill switch support can block all trading immediately with a single active reason.

## Quickstart (3 Commands)

```bash
python -m venv .venv && source .venv/bin/activate
make install
make verify
```

`make verify` runs install, offline demo, tests, and `ui-check`.

## Usage Example

```python
from risk_engine_lab import (
    RiskEngine,
    MaxPositionSize,
    MaxTradesPerDay,
    MaxDailyLoss,
)

engine = RiskEngine(
    limits=[
        MaxPositionSize(max_qty=2.0),
        MaxTradesPerDay(max_trades=5),
        MaxDailyLoss(max_daily_loss_pct=0.02),
    ]
)
```

## Integration Contract

The caller provides:

- an order intent object with at least a `qty` attribute
- a portfolio state object with required fields (`trades_today`, `daily_pnl`, `equity`, `drawdown_pct`, `exposure`)

The engine returns a structured decision:

- `approved: bool`
- `reasons: list[str]`
- `adjusted_qty: Optional[float]`

## Demo and Verification Commands

```bash
make demo
make test
make ui-check
```

## Demo Artifacts

Generated under `outputs/demo_run/`:

- `equity_curve.png`
- `drawdown.png`
- `risk_rejections.png`
- `report.md`

## Roadmap

- richer portfolio/schema validation
- per-symbol and per-strategy limits
- scenario-aware stress gates
