"""
Session analysis: Asia/London/NY session highs and lows, fair value gaps,
liquidity sweeps, and trade opportunity suggestions.
Uses 1h OHLC when available; falls back to daily.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import yfinance as yf

# Session windows (UTC hours): Asia 00–08, London 08–16, NY 14–22 (open ~14:30)
ASIA_START, ASIA_END = 0, 8
LONDON_START, LONDON_END = 8, 16
NY_START, NY_END = 14, 22


@dataclass
class SessionLevels:
    name: str
    high: float
    low: float
    open: float
    close: float
    start_utc: str
    end_utc: str


@dataclass
class FairValueGap:
    kind: str  # "bullish" | "bearish"
    top: float
    bottom: float
    bar_index: int
    label: str = ""


@dataclass
class LiquiditySweep:
    kind: str  # "high_sweep" | "low_sweep"
    level: float
    bar_index: int
    label: str = ""


@dataclass
class SessionAnalysis:
    symbol: str
    session_levels: list[SessionLevels] = field(default_factory=list)
    fvgs: list[FairValueGap] = field(default_factory=list)
    sweeps: list[LiquiditySweep] = field(default_factory=list)
    predicting_ny: str = ""
    opportunities: list[str] = field(default_factory=list)
    daily_high: float = 0.0
    daily_low: float = 0.0
    daily_open: float = 0.0
    daily_close: float = 0.0
    daily_change_pct: float = 0.0
    pattern: str = ""
    pattern_color: str = "dim"
    date: str = ""
    interval: str = "1h"  # "1h" | "1d" (what we used)


def _get_1h(symbol: str, period: str = "5d") -> pd.DataFrame | None:
    try:
        t = yf.Ticker(symbol)
        df = t.history(period=period, interval="1h")
        if df is None or df.empty or len(df) < 3:
            return None
        # Ensure timezone-aware UTC
        if df.index.tz is None:
            df.index = df.index.tz_localize("America/New_York", ambiguous="infer").tz_convert("UTC")
        else:
            df.index = df.index.tz_convert("UTC")
        return df
    except Exception:
        return None


def _get_daily(symbol: str, period: str = "5d") -> pd.DataFrame | None:
    try:
        t = yf.Ticker(symbol)
        df = t.history(period=period, interval="1d")
        if df is None or df.empty or len(df) < 2:
            return None
        return df
    except Exception:
        return None


def _session_name(hour_utc: int) -> str:
    if ASIA_START <= hour_utc < ASIA_END:
        return "Asia"
    if LONDON_START <= hour_utc < LONDON_END:
        return "London"
    if NY_START <= hour_utc < NY_END:
        return "NY"
    return "Overnight"


def _aggregate_session_levels(df: pd.DataFrame) -> list[SessionLevels]:
    """Bucket 1h bars by session and compute high/low/open/close per session."""
    out: list[SessionLevels] = []
    df = df.copy()
    df["hour"] = df.index.hour
    df["session"] = df["hour"].apply(_session_name)
    df["date"] = df.index.date

    for (date, session_name), grp in df.groupby(["date", "session"]):
        if session_name == "Overnight":
            continue
        high = float(grp["High"].max())
        low = float(grp["Low"].min())
        open_ = float(grp["Open"].iloc[0])
        close = float(grp["Close"].iloc[-1])
        start_utc = grp.index.min().strftime("%Y-%m-%d %H:%M") if hasattr(grp.index.min(), "strftime") else str(grp.index.min())
        end_utc = grp.index.max().strftime("%Y-%m-%d %H:%M") if hasattr(grp.index.max(), "strftime") else str(grp.index.max())
        out.append(SessionLevels(
            name=session_name,
            high=high,
            low=low,
            open=open_,
            close=close,
            start_utc=start_utc,
            end_utc=end_utc,
        ))
    return out[-12:]  # last ~12 sessions (e.g. 4 days of 3 sessions)


def _detect_fvg(df: pd.DataFrame, lookback: int = 48) -> list[FairValueGap]:
    """Fair value gaps: 3-candle pattern. Bullish = low[i+2] > high[i]; Bearish = high[i+2] < low[i]."""
    fvgs: list[FairValueGap] = []
    arr = df.tail(lookback)
    if len(arr) < 3:
        return fvgs
    highs = arr["High"].values
    lows = arr["Low"].values
    for i in range(len(arr) - 2):
        if lows[i + 2] > highs[i]:
            fvgs.append(FairValueGap(
                kind="bullish",
                top=float(lows[i + 2]),
                bottom=float(highs[i]),
                bar_index=i + 2,
                label=f"Bullish FVG {highs[i]:.2f}–{lows[i+2]:.2f}",
            ))
        if highs[i + 2] < lows[i]:
            fvgs.append(FairValueGap(
                kind="bearish",
                top=float(lows[i]),
                bottom=float(highs[i + 2]),
                bar_index=i + 2,
                label=f"Bearish FVG {highs[i+2]:.2f}–{lows[i]:.2f}",
            ))
    return fvgs[-6:]  # keep last 6


def _detect_sweeps(df: pd.DataFrame, lookback: int = 24, n_prior: int = 5) -> list[LiquiditySweep]:
    """Liquidity sweep: price takes out prior N-bar high/low then closes back inside."""
    sweeps: list[LiquiditySweep] = []
    arr = df.tail(lookback)
    if len(arr) < n_prior + 2:
        return sweeps
    highs = arr["High"].values
    lows = arr["Low"].values
    opens = arr["Open"].values
    closes = arr["Close"].values

    for i in range(n_prior, len(arr) - 1):
        prior_high = float(max(highs[i - n_prior : i]))
        prior_low = float(min(lows[i - n_prior : i]))
        h, l, o, c = highs[i], lows[i], opens[i], closes[i]
        # High sweep: breaks above prior high then closes below prior high (or in lower half of bar)
        if h > prior_high and c < prior_high:
            sweeps.append(LiquiditySweep(
                kind="high_sweep",
                level=prior_high,
                bar_index=i,
                label=f"Highs swept at {prior_high:.2f}",
            ))
        if l < prior_low and c > prior_low:
            sweeps.append(LiquiditySweep(
                kind="low_sweep",
                level=prior_low,
                bar_index=i,
                label=f"Lows swept at {prior_low:.2f}",
            ))
    return sweeps[-4:]  # last 4


def _predicting_ny(sessions: list[SessionLevels], now_utc: datetime) -> str:
    """Plain-text summary for 'predicting in NY' (CLI adds color when rendering)."""
    if not sessions:
        return ""
    hour = now_utc.hour
    recent = [s for s in sessions[-6:] if s.name in ("Asia", "London", "NY")]
    if not recent:
        return ""
    asia = next((s for s in reversed(recent) if s.name == "Asia"), None)
    london = next((s for s in reversed(recent) if s.name == "London"), None)
    ny = next((s for s in reversed(recent) if s.name == "NY"), None)

    parts = []
    if hour < NY_START and asia:
        parts.append(f"Asia high {asia.high:.2f} · Asia low {asia.low:.2f}")
    if hour < NY_START and london:
        parts.append(f"London high {london.high:.2f} · London low {london.low:.2f}")
    if hour < NY_START:
        parts.append("→ Watch for reaction at NY open (14:30 UTC)")
    elif ny:
        parts.append(f"NY session high {ny.high:.2f} · NY low {ny.low:.2f}")
    return " · ".join(parts) if parts else ""


def _build_opportunities(
    sessions: list[SessionLevels],
    fvgs: list[FairValueGap],
    sweeps: list[LiquiditySweep],
    daily_high: float,
    daily_low: float,
    daily_close: float,
) -> list[str]:
    opps: list[str] = []
    recent = sessions[-6:] if sessions else []

    for fvg in fvgs[-3:]:
        if fvg.kind == "bullish" and daily_close < fvg.top:
            opps.append(f"Long opportunity: bullish FVG {fvg.bottom:.2f}–{fvg.top:.2f} — look for long on retest")
        elif fvg.kind == "bearish" and daily_close > fvg.bottom:
            opps.append(f"Short opportunity: bearish FVG {fvg.bottom:.2f}–{fvg.top:.2f} — look for short on retest")

    for sw in sweeps[-2:]:
        if sw.kind == "low_sweep":
            opps.append(f"Liquidity sweep (lows at {sw.level:.2f}) — potential long if structure holds")
        else:
            opps.append(f"Liquidity sweep (highs at {sw.level:.2f}) — potential short if structure holds")

    asia = next((s for s in reversed(recent) if s.name == "Asia"), None)
    london = next((s for s in reversed(recent) if s.name == "London"), None)
    ny = next((s for s in reversed(recent) if s.name == "NY"), None)
    if asia and daily_close <= asia.high and daily_close >= asia.low:
        opps.append(f"Price inside Asia range {asia.low:.2f}–{asia.high:.2f} — use as support/resistance")
    if london and daily_close <= london.high and daily_close >= london.low:
        opps.append(f"Price inside London range {london.low:.2f}–{london.high:.2f} — key level for NY")
    if ny and daily_close <= ny.high and daily_close >= ny.low:
        opps.append(f"NY range {ny.low:.2f}–{ny.high:.2f} — hold for trend or break for next target")

    return opps[:6]  # cap at 6


def _detect_pattern(df: pd.DataFrame) -> tuple[str, str]:
    if df is None or len(df) < 3:
        return "n/a", "dim"
    highs = df["High"].values
    lows = df["Low"].values
    h1, h0 = highs[-1], highs[-2]
    l1, l0 = lows[-1], lows[-2]
    if h1 > h0 and l1 > l0:
        return "HH/HL (bullish)", "bold green"
    if h1 < h0 and l1 < l0:
        return "LH/LL (bearish)", "bold red"
    if h1 > h0 and l1 < l0:
        return "HH/LL (expansion)", "bold yellow1"
    return "LH/HL (contraction)", "bold blue1"


def run_session_analysis(symbol: str) -> SessionAnalysis | None:
    """Run full session analysis: 1h session levels, FVGs, sweeps, predicting NY, opportunities."""
    df_1h = _get_1h(symbol, period="5d")
    df_daily = _get_daily(symbol, period="5d")
    if df_daily is None or df_daily.empty:
        return None

    last = df_daily.iloc[-1]
    daily_high = float(last["High"])
    daily_low = float(last["Low"])
    daily_open = float(last["Open"])
    daily_close = float(last["Close"])
    daily_change_pct = ((daily_close - daily_open) / daily_open * 100) if daily_open else 0.0
    pattern, pattern_color = _detect_pattern(df_daily)
    date_str = str(df_daily.index[-1].date()) if hasattr(df_daily.index[-1], "date") else str(df_daily.index[-1])

    session_levels: list[SessionLevels] = []
    fvgs: list[FairValueGap] = []
    sweeps: list[LiquiditySweep] = []
    interval = "1d"
    predicting_ny = ""
    opportunities: list[str] = []

    if df_1h is not None and len(df_1h) >= 3:
        interval = "1h"
        session_levels = _aggregate_session_levels(df_1h)
        fvgs = _detect_fvg(df_1h)
        sweeps = _detect_sweeps(df_1h)
        now = datetime.now(timezone.utc)
        predicting_ny = _predicting_ny(session_levels, now)
        opportunities = _build_opportunities(
            session_levels, fvgs, sweeps,
            daily_high, daily_low, daily_close,
        )

    return SessionAnalysis(
        symbol=symbol,
        session_levels=session_levels,
        fvgs=fvgs,
        sweeps=sweeps,
        predicting_ny=predicting_ny,
        opportunities=opportunities,
        daily_high=daily_high,
        daily_low=daily_low,
        daily_open=daily_open,
        daily_close=daily_close,
        daily_change_pct=daily_change_pct,
        pattern=pattern,
        pattern_color=pattern_color,
        date=date_str,
        interval=interval,
    )


def analysis_to_dict(a: SessionAnalysis) -> dict[str, Any]:
    """Serialize for API/JSON."""
    return {
        "symbol": a.symbol,
        "date": a.date,
        "interval": a.interval,
        "daily_high": a.daily_high,
        "daily_low": a.daily_low,
        "daily_open": a.daily_open,
        "daily_close": a.daily_close,
        "daily_change_pct": a.daily_change_pct,
        "pattern": a.pattern,
        "pattern_color": a.pattern_color,
        "session_levels": [
            {
                "name": s.name,
                "high": s.high,
                "low": s.low,
                "open": s.open,
                "close": s.close,
                "start_utc": s.start_utc,
                "end_utc": s.end_utc,
            }
            for s in a.session_levels
        ],
        "fvgs": [
            {"kind": f.kind, "top": f.top, "bottom": f.bottom, "label": f.label}
            for f in a.fvgs
        ],
        "sweeps": [
            {"kind": s.kind, "level": s.level, "label": s.label}
            for s in a.sweeps
        ],
        "predicting_ny": a.predicting_ny,
        "opportunities": a.opportunities,
    }
