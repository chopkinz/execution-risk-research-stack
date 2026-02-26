from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class BarEvent:
    symbol: str
    bar_index: int
    timestamp: pd.Timestamp
