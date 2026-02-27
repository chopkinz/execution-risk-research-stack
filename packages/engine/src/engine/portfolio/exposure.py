from __future__ import annotations

from engine.core.types import PortfolioState


def gross_exposure(state: PortfolioState, mark_price: float) -> float:
    return sum(abs(p.qty * mark_price) for p in state.positions.values())
