from __future__ import annotations

from dataclasses import dataclass

from engine.core.types import OrderIntent, PortfolioState


@dataclass
class MaxPositionSize:
    max_qty: float

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if intent.qty > self.max_qty:
            return "max position size exceeded"
        return None


@dataclass
class MaxTradesPerDay:
    max_trades: int

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if portfolio.trades_today >= self.max_trades:
            return "max trades per day reached"
        return None


@dataclass
class MaxDailyLoss:
    max_daily_loss_pct: float

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if portfolio.equity <= 0:
            return "invalid equity"
        if portfolio.daily_pnl / max(portfolio.equity, 1e-9) <= -abs(self.max_daily_loss_pct):
            return "max daily loss reached"
        return None


@dataclass
class MaxDrawdown:
    max_drawdown_pct: float

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if portfolio.drawdown_pct <= -abs(self.max_drawdown_pct):
            return "max drawdown reached"
        return None


@dataclass
class MaxGrossExposure:
    max_gross_exposure: float

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if portfolio.exposure >= self.max_gross_exposure:
            return "max gross exposure reached"
        return None


@dataclass
class MaxWeeklyLoss:
    max_weekly_loss_pct: float

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        if portfolio.equity <= 0:
            return "invalid equity"
        if portfolio.weekly_pnl / max(portfolio.equity, 1e-9) <= -abs(self.max_weekly_loss_pct):
            return "max weekly loss reached"
        return None


@dataclass
class MaxOpenPositions:
    max_open_positions: int

    def check(self, intent: OrderIntent, portfolio: PortfolioState) -> str | None:
        n = len([p for p in portfolio.positions.values() if p.qty != 0])
        if n >= self.max_open_positions:
            return "max open positions reached"
        return None
