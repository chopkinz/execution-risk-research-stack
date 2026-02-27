from __future__ import annotations

import pandas as pd

from engine.core.types import OrderIntent, OrderType, PortfolioState, Side
from engine.strategy.base import Strategy


class MomentumStrategy(Strategy):
    def __init__(self, symbol: str, threshold: float = 0.0005, qty: float = 1.0) -> None:
        self.symbol = symbol
        self.threshold = threshold
        self.qty = qty

    def on_bar(self, market_data: pd.Series, features: pd.Series, portfolio_state: PortfolioState) -> list[OrderIntent]:
        mom = float(features.get("mom", 0.0))
        intents: list[OrderIntent] = []
        if not bool(features.get("in_session", False)):
            return intents

        if mom > self.threshold:
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.BUY,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=market_data["time"],
                    bar_index=int(features["bar_index"]),
                    metadata={"signal": "momentum_up"},
                )
            )
        elif mom < -self.threshold:
            intents.append(
                OrderIntent(
                    symbol=self.symbol,
                    side=Side.SELL,
                    qty=self.qty,
                    order_type=OrderType.MARKET,
                    timestamp=market_data["time"],
                    bar_index=int(features["bar_index"]),
                    metadata={"signal": "momentum_down"},
                )
            )
        return intents
