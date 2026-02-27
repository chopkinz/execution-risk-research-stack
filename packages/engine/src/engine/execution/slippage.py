from __future__ import annotations


class SlippageModel:
    def __init__(self, k_vol: float = 0.1) -> None:
        self.k_vol = k_vol

    def slippage(self, mid_price: float, volatility: float) -> float:
        return self.k_vol * volatility * mid_price
