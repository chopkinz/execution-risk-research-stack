from __future__ import annotations

from src.core.types import Side


def market_fill_price(mid_price: float, side: Side, spread: float, slippage: float) -> float:
    if side == Side.BUY:
        return mid_price + (spread / 2.0) + slippage
    return mid_price - (spread / 2.0) - slippage
