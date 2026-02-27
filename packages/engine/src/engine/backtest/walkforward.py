from __future__ import annotations

import pandas as pd


def train_test_split(df: pd.DataFrame, ratio: float = 0.7) -> tuple[pd.DataFrame, pd.DataFrame]:
    cut = max(1, int(len(df) * ratio))
    return df.iloc[:cut].copy(), df.iloc[cut:].copy()
