# Session Engine

## Concept

Sessions divide the trading day into **Asia**, **London**, and **New York** windows (and optional overnight). The engine aggregates OHLCV into per-session and per-day levels and exposes them as annotations: session open/close, high/low, range, midpoint, plus Asia/London/NY highs and lows, previous day high/low, and current day open. All times are **America/Chicago** by default with DST handled via `zoneinfo`.

## Implementation

- **Module**: `packages/engine/src/engine/sessions/engine.py`
- **Entry**: `compute_sessions(df, config)` or `SessionEngine(config).compute(df)`.
- **Input**: DataFrame with columns `time`, `open`, `high`, `low`, `close` (and optionally `volume`). `time` is converted to Chicago for bucketing.

## Config Options (SessionConfig)

| Option | Type | Description |
|--------|------|-------------|
| `timezone` | str | Default `"America/Chicago"`. |
| `asia_start`, `asia_end` | (hour, minute) | Asia window in local time (e.g. overnight 18:00–02:00). |
| `london_start`, `london_end` | (hour, minute) | London window. |
| `ny_start`, `ny_end` | (hour, minute) | New York window. |

Session windows can be overridden via config; defaults are set in `engine/sessions/engine.py`.

## Output Annotations

Each annotation includes:

- `id`, `type: "session"`, `name` (Asia | London | NY | current_day | prev_day)
- `open_ts`, `close_ts`, `open_price`, `close_price`, `high`, `low`, `range`, `midpoint`
- `metadata` (e.g. date_ct, prev_high, prev_low for prev_day)

Used for chart overlays (session boxes, key levels) and strategy logic.

## DST

`zoneinfo.ZoneInfo("America/Chicago")` is used so that DST transitions are applied correctly when converting bar times and bucketing by session.

## Failure Cases / Caveats

- **Empty or missing `time`**: Returns empty list.
- **No session column**: Requires `time` to be datetime-like; adds `time_ct`, `date_ct`, `tod_ct` for bucketing.
- **Overnight sessions**: Asia 18:00–02:00 is supported via `_in_session` logic that handles start > end.
