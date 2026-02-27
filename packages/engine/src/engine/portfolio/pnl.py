from __future__ import annotations

from engine.core.types import PortfolioState


def total_realized_pnl(state: PortfolioState) -> float:
    return sum(p.realized_pnl for p in state.positions.values())
