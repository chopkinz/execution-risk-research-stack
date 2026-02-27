from __future__ import annotations


class SpreadModel:
    def __init__(self, min_spread: float = 0.01, spread_bps: float = 1.0) -> None:
        self.min_spread = min_spread
        self.spread_bps = spread_bps

    def spread(self, mid_price: float) -> float:
        return max(self.min_spread, (self.spread_bps / 10000.0) * mid_price)


class SlippageModel:
    def __init__(self, k_vol: float = 0.1) -> None:
        self.k_vol = k_vol

    def slippage(self, mid_price: float, volatility: float) -> float:
        return self.k_vol * volatility * mid_price


class LatencyModel:
    def __init__(self, delay_bars: int = 0) -> None:
        self.delay_bars = max(0, delay_bars)

    def apply(self, bar_index: int) -> int:
        return bar_index + self.delay_bars
