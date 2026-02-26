from __future__ import annotations

import pandas as pd


def add_session_box(df: pd.DataFrame, box_start: str = "08:30", box_end: str = "08:45") -> pd.DataFrame:
    out = df.copy()
    start = pd.to_datetime(box_start).time()
    end = pd.to_datetime(box_end).time()
    mask = out["tod_ct"].apply(lambda t: bool(start <= t <= end))
    box = out[mask].groupby("date_ct").agg(session_box_high=("high", "max"), session_box_low=("low", "min"))
    out = out.merge(box, left_on="date_ct", right_index=True, how="left")
    return out
