# risk-engine-lab

Standalone risk approval engine extracted from the flagship stack.

Source flagship: `https://github.com/chopkinz/execution-risk-research-stack`

## Scope

- Rule-based risk limits
- Kill switch
- Approval/rejection decisions with reasons

## Quickstart

```bash
pip install -e .
python -c "from risk_engine_lab import RiskEngine; print('ok')"
```

## Minimal usage

```python
from risk_engine_lab import RiskEngine, MaxPositionSize

engine = RiskEngine(limits=[MaxPositionSize(max_qty=1.0)])
```
