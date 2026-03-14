# Fair Value Gap (FVG) Engine

## Concept

A **Fair Value Gap** is a three-candle imbalance: price leaves a gap between candle i−1 and candle i+1 that is not filled by the middle candle.

- **Bullish FVG**: `candle[i-1].high < candle[i+1].low` — gap between prior high and next low.
- **Bearish FVG**: `candle[i-1].low > candle[i+1].high` — gap between next high and prior low.

The engine detects these gaps, filters by configurable size, tracks fill state over time, and scores each FVG for chart overlay and strategy use.

## Implementation

- **Module**: `packages/engine/src/engine/signals/fvg.py`
- **Detection**: `detect_fvgs(df)` or `FVGEngine(config).detect(df)`.
- **Lifecycle**: Each FVG has a `status`: `created` → `still_open` | `partially_filled` → `fully_filled` | `invalidated`. Fill state is updated with `engine.update_fill_states(fvgs, df, fill_method)`.

## Config Options (FVGConfig)

| Option | Type | Description |
|--------|------|-------------|
| `min_gap_absolute` | float \| None | Minimum gap size in price units. |
| `min_gap_ticks` | float \| None | Minimum size in tick multiples (`tick_size`). |
| `tick_size` | float | Tick size for size_ticks and tick filter. |
| `min_gap_atr_multiple` | float \| None | Minimum gap as multiple of ATR (`atr_period`). |
| `atr_period` | int | ATR lookback for volatility filter. |
| `min_gap_pct` | float \| None | Minimum gap as % of reference price. |
| `fill_method` | touch \| midpoint \| full_body | How “filled” is defined (touch edge, cross midpoint, or full body). |
| `merge_adjacent_bars` | int | Merge FVGs of same direction within this many bars (0 = no merge). |
| `score_*_weight` | float | Weights for size, imbalance, session proximity, trend in score. |

## Output Annotation Shape

Each FVG is returned as a structured annotation (e.g. for `annotations.json` and chart overlays):

- `id`, `type: "fvg"`, `direction` (bullish | bearish)
- `start_ts`, `end_ts`, `upper`, `lower`, `midpoint`, `size`, `size_ticks`, `atr_multiple`
- `status`, `fill_percent`, `score`, `bar_index`, `metadata`

## Failure Cases / Caveats

- **Too few bars**: Fewer than 3 bars → no FVGs.
- **ATR filter**: If `min_gap_atr_multiple` is set and ATR is zero/NaN at a bar, that bar’s FVG can be excluded.
- **Fill state**: Update uses only future bars from `bar_index`; run on full series for correct lifecycle.
- **Timestamps**: Expect `df["time"]` to be timezone-aware (e.g. UTC) for correct `start_ts`/`end_ts`.
