from __future__ import annotations

from abc import ABC, abstractmethod
import pandas as pd

from engine.core.models import Bar
from engine.core.types import OrderIntent, PortfolioState


class Strategy(ABC):
    """
    Standard strategy interface: prepare -> on_bar (per bar) -> finalize.
    Event-driven; one bar at a time. Use prepare() for O(n) precomputation; on_bar is O(1) per bar.
    """

    def prepare(self, features_df: pd.DataFrame) -> None:
        """Called once before the event loop. Use to precompute indicators or cache. O(n) acceptable here."""
        pass

    @abstractmethod
    def on_bar(
        self,
        bar: Bar,
        features: pd.Series,
        portfolio_state: PortfolioState,
    ) -> list[OrderIntent]:
        """Called each bar. Return order intents (risk/execution applied by runner). O(1) per bar."""
        raise NotImplementedError

    def finalize(self) -> None:
        """Called once after the event loop."""
        pass
