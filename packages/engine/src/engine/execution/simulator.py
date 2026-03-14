from __future__ import annotations

from dataclasses import dataclass

from engine.core.types import Fill, OrderIntent
from engine.execution.fills import market_fill_price
from engine.execution.latency import LatencyModel
from engine.execution.slippage import SlippageModel
from engine.execution.spread import SpreadModel


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
            effective_bar = self.latency_model.apply(intent.bar_index)
            spread = self.spread_model.spread(mid)
            slip = self.slippage_model.slippage(mid, vol)
            fill_price = market_fill_price(mid_price=mid, side=intent.side, spread=spread, slippage=slip)
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
                    bar_index=effective_bar,
                    expected_price=float(mid),
                    metadata={"spread": spread},
                )
            )
        return fills
