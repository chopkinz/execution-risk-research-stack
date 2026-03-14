from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import pandas as pd


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"


@dataclass
class OrderIntent:
    symbol: str
    side: Side
    qty: float
    order_type: OrderType
    timestamp: pd.Timestamp
    bar_index: int
    limit_price: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskDecision:
    approved: bool
    reasons: list[str] = field(default_factory=list)
    adjusted_qty: float | None = None


@dataclass
class Fill:
    symbol: str
    side: Side
    qty: float
    fill_price: float
    fees: float
    slippage: float
    timestamp: pd.Timestamp
    bar_index: int
    expected_price: float | None = None  # mid/limit at order time for audit
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Position:
    symbol: str
    qty: float = 0.0
    avg_price: float = 0.0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0


@dataclass
class PortfolioState:
    cash: float
    equity: float
    positions: dict[str, Position] = field(default_factory=dict)
    exposure: float = 0.0
    daily_pnl: float = 0.0
    weekly_pnl: float = 0.0
    peak_equity: float = 0.0
    drawdown_pct: float = 0.0
    trades_today: int = 0
    current_date: str | None = None
    current_week: str | None = None  # ISO week e.g. "2024-W01"


@dataclass
class BacktestResult:
    trades: pd.DataFrame
    equity_curve: pd.DataFrame
    metrics: dict[str, float]
    config_used: dict[str, Any]
    logs_path: str
    output_dir: str
