from __future__ import annotations


class SpreadModel:
    def __init__(self, min_spread: float = 0.01, spread_bps: float = 1.0) -> None:
        self.min_spread = min_spread
        self.spread_bps = spread_bps

    def spread(self, mid_price: float) -> float:
        return max(self.min_spread, (self.spread_bps / 10000.0) * mid_price)
