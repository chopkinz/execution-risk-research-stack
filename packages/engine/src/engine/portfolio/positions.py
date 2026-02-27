from __future__ import annotations

from engine.core.types import Position


def get_or_create(positions: dict[str, Position], symbol: str) -> Position:
    if symbol not in positions:
        positions[symbol] = Position(symbol=symbol)
    return positions[symbol]
