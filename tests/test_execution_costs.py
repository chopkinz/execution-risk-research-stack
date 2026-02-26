from __future__ import annotations

import pandas as pd

from src.core.types import OrderIntent, OrderType, Side
from src.execution.latency import LatencyModel
from src.execution.simulator import ExecutionSimulator
from src.execution.slippage import SlippageModel
from src.execution.spread import SpreadModel


def test_execution_applies_spread_slippage_and_fee() -> None:
    sim = ExecutionSimulator(
        spread_model=SpreadModel(min_spread=0.1, spread_bps=0.0),
        slippage_model=SlippageModel(k_vol=0.0),
        latency_model=LatencyModel(delay_bars=1),
        fee_bps=10.0,
    )
    intent = OrderIntent(
        symbol="T",
        side=Side.BUY,
        qty=1.0,
        order_type=OrderType.MARKET,
        timestamp=pd.Timestamp.utcnow(),
        bar_index=5,
    )
    fills = sim.simulate_fills([intent], {"mid_price": 100.0, "volatility": 0.0})
    f = fills[0]
    assert abs(f.fill_price - 100.05) < 1e-9
    assert f.bar_index == 6
    assert f.fees > 0
