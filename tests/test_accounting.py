from __future__ import annotations

import pandas as pd

from src.core.types import Fill, PortfolioState, Side
from src.portfolio.accounting import apply_fills


def test_accounting_buy_sell_realized_pnl() -> None:
    state = PortfolioState(cash=1000.0, equity=1000.0)
    fill_buy = Fill(symbol="T", side=Side.BUY, qty=1.0, fill_price=100.0, fees=0.0, slippage=0.0, timestamp=pd.Timestamp.utcnow(), bar_index=0)
    fill_sell = Fill(symbol="T", side=Side.SELL, qty=1.0, fill_price=110.0, fees=0.0, slippage=0.0, timestamp=pd.Timestamp.utcnow(), bar_index=1)
    s1 = apply_fills([fill_buy], state, mark_price=100.0, current_date="2026-01-01")
    s2 = apply_fills([fill_sell], s1, mark_price=110.0, current_date="2026-01-01")
    pos = s2.positions["T"]
    assert pos.qty == 0.0
    assert round(pos.realized_pnl, 5) == 10.0
