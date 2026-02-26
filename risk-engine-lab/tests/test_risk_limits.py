from __future__ import annotations

from dataclasses import dataclass

from risk_engine_lab import MaxPositionSize, RiskEngine


@dataclass
class Intent:
    qty: float


@dataclass
class Portfolio:
    trades_today: int = 0
    daily_pnl: float = 0.0
    equity: float = 100000.0
    drawdown_pct: float = 0.0
    exposure: float = 0.0


def test_rejects_oversized_quantity() -> None:
    engine = RiskEngine(limits=[MaxPositionSize(max_qty=1.0)])
    decision = engine.evaluate(Intent(qty=2.0), Portfolio(), {})
    assert decision.approved is False
    assert any("max position size" in r for r in decision.reasons)
