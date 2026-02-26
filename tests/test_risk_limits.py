from __future__ import annotations

import pandas as pd

from src.core.types import OrderIntent, OrderType, PortfolioState, Side
from src.risk.engine import RiskEngine
from src.risk.limits import MaxPositionSize


def test_risk_rejects_oversized_order() -> None:
    engine = RiskEngine(limits=[MaxPositionSize(max_qty=1.0)])
    intent = OrderIntent(
        symbol="T",
        side=Side.BUY,
        qty=2.0,
        order_type=OrderType.MARKET,
        timestamp=pd.Timestamp.utcnow(),
        bar_index=0,
    )
    decision = engine.evaluate(intent, PortfolioState(cash=1000.0, equity=1000.0), {})
    assert decision.approved is False
    assert any("max position size" in r for r in decision.reasons)
