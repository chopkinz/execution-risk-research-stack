from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RiskDecision:
    approved: bool
    reasons: list[str] = field(default_factory=list)
    adjusted_qty: float | None = None


@dataclass
class RiskEngine:
    limits: list[Any] = field(default_factory=list)
    kill_switch_active: bool = False
    kill_switch_reason: str = ""

    def evaluate(self, order_intent: Any, portfolio_state: Any, market_context: dict | None = None) -> RiskDecision:
        if self.kill_switch_active:
            return RiskDecision(approved=False, reasons=[f"kill switch active: {self.kill_switch_reason}"])
        reasons: list[str] = []
        for limit in self.limits:
            reason = limit.check(order_intent, portfolio_state)
            if reason:
                reasons.append(reason)
        return RiskDecision(approved=(len(reasons) == 0), reasons=reasons, adjusted_qty=getattr(order_intent, "qty", None))
