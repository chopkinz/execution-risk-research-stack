from __future__ import annotations

from dataclasses import replace

from engine.core.types import Fill, PortfolioState, Side
from engine.portfolio.positions import get_or_create


def _apply_fill(fill: Fill, state: PortfolioState) -> None:
    pos = get_or_create(state.positions, fill.symbol)
    signed_qty = fill.qty if fill.side == Side.BUY else -fill.qty

    # Closing component realized PnL
    if pos.qty != 0 and (pos.qty > 0 > signed_qty or pos.qty < 0 < signed_qty):
        close_qty = min(abs(pos.qty), abs(signed_qty))
        if pos.qty > 0:
            pos.realized_pnl += close_qty * (fill.fill_price - pos.avg_price)
        else:
            pos.realized_pnl += close_qty * (pos.avg_price - fill.fill_price)

    new_qty = pos.qty + signed_qty
    if new_qty == 0:
        pos.avg_price = 0.0
    elif pos.qty == 0 or (pos.qty > 0 and new_qty > 0 and signed_qty > 0) or (pos.qty < 0 and new_qty < 0 and signed_qty < 0):
        pos.avg_price = ((abs(pos.qty) * pos.avg_price) + (abs(signed_qty) * fill.fill_price)) / abs(new_qty)
    elif abs(signed_qty) > abs(pos.qty):
        pos.avg_price = fill.fill_price
    pos.qty = new_qty
    state.cash -= (signed_qty * fill.fill_price) + fill.fees


def apply_fills(fills: list[Fill], portfolio_state: PortfolioState, mark_price: float, current_date: str) -> PortfolioState:
    state = replace(portfolio_state)
    state.positions = {k: replace(v) for k, v in portfolio_state.positions.items()}

    if state.current_date != current_date:
        state.current_date = current_date
        state.trades_today = 0
        state.daily_pnl = 0.0

    for fill in fills:
        _apply_fill(fill, state)
        state.trades_today += 1

    unrealized = 0.0
    exposure = 0.0
    realized = 0.0
    for p in state.positions.values():
        if p.qty > 0:
            p.unrealized_pnl = p.qty * (mark_price - p.avg_price)
        elif p.qty < 0:
            p.unrealized_pnl = abs(p.qty) * (p.avg_price - mark_price)
        else:
            p.unrealized_pnl = 0.0
        realized += p.realized_pnl
        unrealized += p.unrealized_pnl
        exposure += abs(p.qty * mark_price)

    state.equity = state.cash + unrealized + sum(abs(p.qty) * p.avg_price for p in state.positions.values())
    state.exposure = exposure
    state.daily_pnl = realized + unrealized
    state.peak_equity = max(state.peak_equity, state.equity)
    state.drawdown_pct = (state.equity / max(state.peak_equity, 1e-9)) - 1.0
    return state
