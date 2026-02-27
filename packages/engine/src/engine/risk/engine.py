from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from engine.core.types import OrderIntent, PortfolioState, RiskDecision
from engine.risk.kill_switch import KillSwitch


@dataclass
class RiskEngine:
    limits: list[Any] = field(default_factory=list)
    kill_switch: KillSwitch = field(default_factory=KillSwitch)

    def evaluate(self, order_intent: OrderIntent, portfolio_state: PortfolioState, market_context: dict | None = None) -> RiskDecision:
        if self.kill_switch.active:
            return RiskDecision(approved=False, reasons=[f"kill switch active: {self.kill_switch.reason}"])
        reasons: list[str] = []
        for limit in self.limits:
            reason = limit.check(order_intent, portfolio_state)
            if reason:
                reasons.append(reason)
        return RiskDecision(approved=(len(reasons) == 0), reasons=reasons, adjusted_qty=order_intent.qty)
