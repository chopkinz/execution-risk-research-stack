# execution-sim-lab

Standalone execution simulation module extracted from the flagship stack.

Source flagship: `https://github.com/chopkinz/execution-risk-research-stack`

## Scope

- Spread model
- Slippage model
- Latency model
- Fill simulation interface

## Quickstart

```bash
pip install -e .
python -c "from execution_sim_lab import ExecutionSimulator; print('ok')"
```

## Minimal usage

```python
from execution_sim_lab import ExecutionSimulator, SpreadModel, SlippageModel, LatencyModel

sim = ExecutionSimulator(
    spread_model=SpreadModel(min_spread=0.01, spread_bps=1.0),
    slippage_model=SlippageModel(k_vol=0.1),
    latency_model=LatencyModel(delay_bars=0),
    fee_bps=0.5,
)
```
