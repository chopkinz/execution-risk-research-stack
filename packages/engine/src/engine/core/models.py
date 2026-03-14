"""
Normalized core engine types for correctness, performance, and maintainability.

All domain entities used across data ingestion, annotation, strategy, risk,
execution, accounting, and reporting are defined here or in core.types.
Use dataclasses for strongly defined entities; typed dicts only where appropriate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

import pandas as pd


# -----------------------------------------------------------------------------
# Bar — single OHLCV bar (immutable view for event-driven loop)
# -----------------------------------------------------------------------------


@dataclass(frozen=True)
class Bar:
    """
    Single OHLCV bar. Used as the canonical market-data view per bar in the backtest loop.
    Immutable to avoid accidental mutation; creation is O(1) per bar.
    """

    symbol: str
    bar_index: int
    time: pd.Timestamp
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    @classmethod
    def from_series(cls, row: pd.Series, symbol: str = "", bar_index: int | None = None) -> Bar:
        """Build a Bar from a dataframe row (e.g. features row). O(1)."""
        idx = 0
        if "bar_index" in row.index:
            idx = int(row["bar_index"])
        elif bar_index is not None:
            idx = bar_index
        else:
            name = getattr(row, "name", None)
            idx = int(name) if name is not None else 0
        time_val = row["time"] if "time" in row.index else pd.Timestamp.now(tz="UTC")
        return cls(
            symbol=str(symbol),
            bar_index=idx,
            time=pd.Timestamp(time_val) if not isinstance(time_val, pd.Timestamp) else time_val,
            open=float(row.get("open", 0.0)),
            high=float(row.get("high", 0.0)),
            low=float(row.get("low", 0.0)),
            close=float(row.get("close", 0.0)),
            volume=float(row.get("volume", 0.0)),
        )


# -----------------------------------------------------------------------------
# Annotation — protocol for chart/strategy annotations (FVG, session, structure)
# -----------------------------------------------------------------------------


@runtime_checkable
class Annotation(Protocol):
    """Protocol for any annotation (FVG, session, structure) used in chart overlays and APIs."""

    @property
    def id(self) -> str:
        ...

    @property
    def type(self) -> str:
        ...

    def to_dict(self) -> dict[str, Any]:
        ...


# -----------------------------------------------------------------------------
# RiskEvent — single risk rejection for audit and reporting
# -----------------------------------------------------------------------------


@dataclass
class RiskEvent:
    """Single risk rejection event. Used for audit trail and artifact (risk_log, risk_rejections)."""

    time: pd.Timestamp
    symbol: str
    reason: str
    bar_index: int = -1
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "time": self.time.isoformat() if hasattr(self.time, "isoformat") else str(self.time),
            "symbol": self.symbol,
            "reason": self.reason,
            "bar_index": self.bar_index,
            **self.metadata,
        }


# -----------------------------------------------------------------------------
# RunArtifact — description of one output file for API/docs
# -----------------------------------------------------------------------------


@dataclass
class RunArtifact:
    """Describes a single run output file for API listing and documentation."""

    path: Path | str
    kind: str  # e.g. "summary", "equity_curve", "report_md", "trades_csv"
    description: str = ""
    content_type: str = "application/octet-stream"

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": str(self.path),
            "kind": self.kind,
            "description": self.description,
            "content_type": self.content_type,
        }
