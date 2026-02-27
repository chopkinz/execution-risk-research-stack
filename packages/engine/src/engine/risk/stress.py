from __future__ import annotations

import pandas as pd


def shock_equity_curve(equity_curve: pd.DataFrame, shock_pct: float = -0.05) -> pd.DataFrame:
    out = equity_curve.copy()
    out["equity_shocked"] = out["equity"] * (1.0 + shock_pct)
    return out
