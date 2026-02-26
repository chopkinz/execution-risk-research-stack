from __future__ import annotations

import pandas as pd

from src.features.momentum import add_momentum


def test_momentum_feature_no_lookahead() -> None:
    df = pd.DataFrame({"close": [100, 101, 102, 103, 104, 105]})
    out = add_momentum(df, lookback=3)
    # Value at t should not include return at t.
    # At index 4, mean uses returns of idx 1..3 due to shift.
    expected = ((101 / 100 - 1) + (102 / 101 - 1) + (103 / 102 - 1)) / 3
    assert abs(out.loc[4, "mom"] - expected) < 1e-12
