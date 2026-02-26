from __future__ import annotations

import pandas as pd


def add_air_pocket_flags(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["air_pocket_up"] = (out["high"].shift(2) < out["low"]).fillna(False)
    out["air_pocket_down"] = (out["low"].shift(2) > out["high"]).fillna(False)
    out["air_pocket_upper"] = out["low"].where(out["air_pocket_up"], out["low"].shift(2))
    out["air_pocket_lower"] = out["high"].shift(2).where(out["air_pocket_up"], out["high"])
    return out
