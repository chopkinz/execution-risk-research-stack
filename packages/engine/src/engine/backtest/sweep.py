from __future__ import annotations

import itertools
from dataclasses import dataclass


@dataclass
class SweepParams:
    impulse_k: list[float]
    tap_pct: list[float]
    confirmation_strength: list[float]
    r_multiple: list[float]
    time_stop: list[int]
    chop_filter: list[float]


def build_grid(params: SweepParams) -> list[dict]:
    rows = []
    for values in itertools.product(
        params.impulse_k,
        params.tap_pct,
        params.confirmation_strength,
        params.r_multiple,
        params.time_stop,
        params.chop_filter,
    ):
        rows.append(
            {
                "impulse_k": values[0],
                "tap_pct": values[1],
                "confirmation_strength": values[2],
                "r_multiple": values[3],
                "time_stop": values[4],
                "chop_filter": values[5],
            }
        )
    return rows
