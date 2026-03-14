"""
Session breakout / liquidity sweep style strategy.

Long when price breaks above session box high (within session); short when below session box low.
Fully parameterized via config (symbol, qty, session box buffer, etc.).
"""

from __future__ import annotations

import pandas as pd

from engine.core.models import Bar
from engine.core.types import OrderIntent, OrderType, PortfolioState, Side
from engine.strategy.base import Strategy


class SessionBreakoutStrategy(Strategy):
    def __init__(
        self,
        symbol: str,
        qty: float = 1.0,
        buffer_pct: float = 0.0,
        only_in_session: bool = True,
    ) -> None:
        self.symbol = symbol
        self.qty = qty
        self.buffer_pct = buffer_pct
        self.only_in_session = only_in_session

    def on_bar(self, bar: Bar, features: pd.Series, portfolio_state: PortfolioState) -> list[OrderIntent]:
        intents: list[OrderIntent] = []
        if self.only_in_session and not bool(features.get("in_session", False)):
            return intents

        sh = features.get("session_box_high")
        sl = features.get("session_box_low")
        if pd.isna(sh) or pd.isna(sl):
            return intents

        sh = float(sh)
        sl = float(sl)
        buf = (sh - sl) * (self.buffer_pct / 100.0) if self.buffer_pct else 0.0
        if bar.close > sh + buf:
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.BUY,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=bar.time,
                    bar_index=bar.bar_index,
                    metadata={"signal": "session_breakout_long"},
                )
            )
        elif bar.close < sl - buf:
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.SELL,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=bar.time,
                    bar_index=bar.bar_index,
                    metadata={"signal": "session_breakout_short"},
                )
            )
        return intents
