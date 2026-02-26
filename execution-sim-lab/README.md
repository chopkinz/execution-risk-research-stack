# execution-sim-lab

Execution simulation package for deterministic backtests and execution-cost-aware research.

## Context

`execution-sim-lab` is the execution layer extracted from the flagship stack:

- Source integration repo: `https://github.com/chopkinz/execution-risk-research-stack`
- Sibling risk module: `https://github.com/chopkinz/risk-engine-lab`

The module is intentionally focused: it simulates fills under configurable spread, slippage, latency, and fee assumptions.

## Capabilities

- Deterministic market-order fill simulation
- Spread model: `spread = max(min_spread, spread_bps * mid_price)`
- Slippage model: volatility-scaled impact
- Latency model: configurable fill delay by bars
- Transaction fee modeling in basis points

## What This Package Does Not Do (Yet)

- Level-2 order book depth
- Partial fills
- Queue position modeling
- Venue-specific microstructure rules

## Quickstart (3 Commands)

```bash
python -m venv .venv && source .venv/bin/activate
make install
make verify
```

`make verify` runs install, offline demo, tests, and `ui-check`.

## Usage Example

```python
import pandas as pd
from execution_sim_lab import (
    ExecutionSimulator,
    SpreadModel,
    SlippageModel,
    LatencyModel,
    OrderIntent,
    Side,
)

sim = ExecutionSimulator(
    spread_model=SpreadModel(min_spread=0.01, spread_bps=1.0),
    slippage_model=SlippageModel(k_vol=0.1),
    latency_model=LatencyModel(delay_bars=1),
    fee_bps=0.5,
)

intent = OrderIntent(
    symbol="^NDX",
    side=Side.BUY,
    qty=1.0,
    timestamp=pd.Timestamp.utcnow(),
    bar_index=10,
)

fills = sim.simulate_fills(
    [intent],
    market_context={"mid_price": 20000.0, "volatility": 0.0012},
)
```

## Integration Contract

The caller is responsible for:

- Producing validated `OrderIntent` objects
- Supplying market context (`mid_price`, `volatility`)
- Applying returned fills to a portfolio/accounting layer

This separation keeps execution simulation pure and portable across research stacks.

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

- Optional partial fill logic
- Limit-order path simulation
- Depth-aware slippage extensions
