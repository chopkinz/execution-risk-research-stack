from __future__ import annotations

from dataclasses import dataclass


@dataclass
class MaxPositionSize:
    max_qty: float

    def check(self, intent, portfolio) -> str | None:
        if intent.qty > self.max_qty:
            return "max position size exceeded"
        return None


@dataclass
class MaxTradesPerDay:
    max_trades: int

    def check(self, intent, portfolio) -> str | None:
        if portfolio.trades_today >= self.max_trades:
            return "max trades per day reached"
        return None


@dataclass
class MaxDailyLoss:
    max_daily_loss_pct: float

    def check(self, intent, portfolio) -> str | None:
        if portfolio.equity <= 0:
            return "invalid equity"
        if portfolio.daily_pnl / max(portfolio.equity, 1e-9) <= -abs(self.max_daily_loss_pct):
            return "max daily loss reached"
        return None


@dataclass
class MaxDrawdown:
    max_drawdown_pct: float

    def check(self, intent, portfolio) -> str | None:
        if portfolio.drawdown_pct <= -abs(self.max_drawdown_pct):
            return "max drawdown reached"
        return None


@dataclass
class MaxGrossExposure:
    max_gross_exposure: float

    def check(self, intent, portfolio) -> str | None:
        if portfolio.exposure >= self.max_gross_exposure:
            return "max gross exposure reached"
        return None
