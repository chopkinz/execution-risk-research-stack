from __future__ import annotations

import pandas as pd

from engine.data.calendar import add_chicago_time, session_mask
from engine.features.fvg import add_air_pocket_flags
from engine.features.liquidity import add_session_box
from engine.features.momentum import add_momentum


def build_features(df: pd.DataFrame, session_start: str = "08:30", session_end: str = "10:30") -> pd.DataFrame:
    out = add_chicago_time(df)
    out = add_momentum(out)
    out = add_session_box(out)
    out = add_air_pocket_flags(out)
    out["in_session"] = session_mask(out, start=session_start, end=session_end)
    return out
