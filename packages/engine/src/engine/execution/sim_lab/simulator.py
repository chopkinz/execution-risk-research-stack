from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import pandas as pd

from engine.execution.sim_lab.models import LatencyModel, SlippageModel, SpreadModel


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass
class OrderIntent:
    symbol: str
    side: Side
    qty: float
    timestamp: pd.Timestamp
    bar_index: int


@dataclass
class Fill:
    symbol: str
    side: Side
    qty: float
    fill_price: float
    fees: float
    slippage: float
    timestamp: pd.Timestamp
    bar_index: int
    metadata: dict[str, Any] = field(default_factory=dict)


def market_fill_price(mid_price: float, side: Side, spread: float, slippage: float) -> float:
    if side == Side.BUY:
        return mid_price + (spread / 2.0) + slippage
    return mid_price - (spread / 2.0) - slippage


@dataclass
class ExecutionSimulator:
    spread_model: SpreadModel
    slippage_model: SlippageModel
    latency_model: LatencyModel
    fee_bps: float = 0.5

    def simulate_fills(self, order_intents: list[OrderIntent], market_context: dict) -> list[Fill]:
        fills: list[Fill] = []
        mid = float(market_context["mid_price"])
        vol = float(market_context.get("volatility", 0.001))
        for intent in order_intents:
            spread = self.spread_model.spread(mid)
            slip = self.slippage_model.slippage(mid, vol)
            fill_price = market_fill_price(mid, intent.side, spread, slip)
            fees = (self.fee_bps / 10000.0) * abs(intent.qty * fill_price)
            fills.append(
                Fill(
                    symbol=intent.symbol,
                    side=intent.side,
                    qty=float(intent.qty),
                    fill_price=float(fill_price),
                    fees=float(fees),
                    slippage=float(slip),
                    timestamp=intent.timestamp,
                    bar_index=self.latency_model.apply(intent.bar_index),
                    metadata={"spread": spread},
                )
            )
        return fills
