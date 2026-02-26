from __future__ import annotations

import pandas as pd

from execution_sim_lab import ExecutionSimulator, LatencyModel, OrderIntent, Side, SlippageModel, SpreadModel


def test_costs_and_latency_applied() -> None:
    sim = ExecutionSimulator(
        spread_model=SpreadModel(min_spread=0.1, spread_bps=0.0),
        slippage_model=SlippageModel(k_vol=0.0),
        latency_model=LatencyModel(delay_bars=2),
        fee_bps=10.0,
    )
    intent = OrderIntent(symbol="S", side=Side.BUY, qty=1.0, timestamp=pd.Timestamp.utcnow(), bar_index=1)
    fill = sim.simulate_fills([intent], {"mid_price": 100.0, "volatility": 0.0})[0]
    assert abs(fill.fill_price - 100.05) < 1e-9
    assert fill.bar_index == 3
    assert fill.fees > 0
