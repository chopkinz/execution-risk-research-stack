from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd

from engine.core.types import OrderIntent, PortfolioState


class Strategy(ABC):
    @abstractmethod
    def on_bar(self, market_data: pd.Series, features: pd.Series, portfolio_state: PortfolioState) -> list[OrderIntent]:
        raise NotImplementedError
