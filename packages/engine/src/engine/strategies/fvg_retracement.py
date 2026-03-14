"""
FVG retracement strategy: long on retrace into bullish FVG, short into bearish FVG.

Uses air_pocket (FVG) flags from the feature pipeline. Fully parameterized.
"""

from __future__ import annotations

import pandas as pd

from engine.core.models import Bar
from engine.core.types import OrderIntent, OrderType, PortfolioState, Side
from engine.strategy.base import Strategy


class FVGRetracementStrategy(Strategy):
    def __init__(
        self,
        symbol: str,
        qty: float = 1.0,
        only_in_session: bool = True,
        use_bullish: bool = True,
        use_bearish: bool = True,
    ) -> None:
        self.symbol = symbol
        self.qty = qty
        self.only_in_session = only_in_session
        self.use_bullish = use_bullish
        self.use_bearish = use_bearish

    def on_bar(self, bar: Bar, features: pd.Series, portfolio_state: PortfolioState) -> list[OrderIntent]:
        intents: list[OrderIntent] = []
        if self.only_in_session and not bool(features.get("in_session", False)):
            return intents

        if self.use_bullish and bool(features.get("air_pocket_up", False)):
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.BUY,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=bar.time,
                    bar_index=bar.bar_index,
                    metadata={"signal": "fvg_retracement_long"},
                )
            )
        if self.use_bearish and bool(features.get("air_pocket_down", False)):
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.SELL,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=bar.time,
                    bar_index=bar.bar_index,
                    metadata={"signal": "fvg_retracement_short"},
                )
            )
        return intents
