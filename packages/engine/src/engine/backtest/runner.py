from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from engine.backtest.engine import run_backtest
from engine.data.loaders import YahooRequest, load_yahoo
from engine.data.providers import SYMBOL_PRESETS, load_with_preset
from engine.data.storage import ensure_dirs
from engine.execution.latency import LatencyModel
from engine.execution.simulator import ExecutionSimulator
from engine.execution.slippage import SlippageModel
from engine.execution.spread import SpreadModel
from engine.risk.engine import RiskEngine
from engine.risk.limits import (
    MaxDailyLoss,
    MaxDrawdown,
    MaxGrossExposure,
    MaxOpenPositions,
    MaxPositionSize,
    MaxTradesPerDay,
    MaxWeeklyLoss,
)
from engine.strategy.base import Strategy
from engine.strategy.examples.momentum_strategy import MomentumStrategy
from engine.strategies.session_breakout import SessionBreakoutStrategy
from engine.strategies.fvg_retracement import FVGRetracementStrategy


def make_strategy(cfg: dict[str, Any]) -> Strategy:
    name = (cfg.get("strategy") or {}).get("name", "momentum")
    strat_cfg = cfg.get("strategy") or {}
    symbol = cfg["symbol"]
    qty = float(strat_cfg.get("qty", 1.0))
    if name == "session_breakout":
        return SessionBreakoutStrategy(
            symbol=symbol,
            qty=qty,
            buffer_pct=float(strat_cfg.get("buffer_pct", 0.0)),
            only_in_session=bool(strat_cfg.get("only_in_session", True)),
        )
    if name == "fvg_retracement":
        return FVGRetracementStrategy(
            symbol=symbol,
            qty=qty,
            only_in_session=bool(strat_cfg.get("only_in_session", True)),
            use_bullish=bool(strat_cfg.get("use_bullish", True)),
            use_bearish=bool(strat_cfg.get("use_bearish", True)),
        )
    return MomentumStrategy(
        symbol=symbol,
        threshold=float(strat_cfg.get("threshold", 0.0005)),
        qty=qty,
    )


def make_risk_engine(cfg: dict[str, Any]) -> RiskEngine:
    limits: list[Any] = [
        MaxPositionSize(cfg["risk"]["max_position_size"]),
        MaxTradesPerDay(cfg["risk"]["max_trades_per_day"]),
        MaxDailyLoss(cfg["risk"]["max_daily_loss_pct"]),
        MaxDrawdown(cfg["risk"]["max_drawdown_pct"]),
        MaxGrossExposure(cfg["risk"]["max_gross_exposure"]),
    ]
    if "max_weekly_loss_pct" in cfg.get("risk", {}):
        limits.append(MaxWeeklyLoss(cfg["risk"]["max_weekly_loss_pct"]))
    if "max_open_positions" in cfg.get("risk", {}):
        limits.append(MaxOpenPositions(cfg["risk"]["max_open_positions"]))
    return RiskEngine(limits=limits)


def make_execution_simulator(cfg: dict[str, Any]) -> ExecutionSimulator:
    return ExecutionSimulator(
        spread_model=SpreadModel(min_spread=cfg["execution"]["min_spread"], spread_bps=cfg["execution"]["spread_bps"]),
        slippage_model=SlippageModel(k_vol=cfg["execution"]["slippage_k"]),
        latency_model=LatencyModel(delay_bars=cfg["execution"]["delay_bars"]),
        fee_bps=cfg["execution"]["fee_bps"],
    )


def load_data_from_config(root: Path, cfg: dict[str, Any], force_refresh: bool = False) -> pd.DataFrame:
    dirs = ensure_dirs(root)
    symbol = cfg["symbol"]
    interval = cfg["interval"]
    period = cfg.get("period")
    if symbol.strip().upper() in SYMBOL_PRESETS:
        return load_with_preset(
            symbol=symbol,
            interval=interval,
            period=period,
            cache_dir=dirs["data"],
            force_refresh=force_refresh,
        )
    return load_yahoo(
        YahooRequest(
            symbol=symbol,
            interval=interval,
            period=period,
            force_refresh=force_refresh,
        ),
        cache_dir=dirs["data"],
    )


def default_run_dir(root: Path, cfg: dict[str, Any], prefix: str = "") -> Path:
    dirs = ensure_dirs(root)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    sym = cfg["symbol"].replace("^", "IDX_").replace("=", "_")
    name = f"{prefix}{ts}_{sym}_{cfg['interval']}"
    return dirs["outputs"] / name


def run_from_config(
    root: Path,
    cfg: dict[str, Any],
    data: pd.DataFrame | None = None,
    output_dir: Path | None = None,
) -> tuple[dict[str, float], str]:
    df = data if data is not None else load_data_from_config(root, cfg)
    out = output_dir if output_dir is not None else default_run_dir(root, cfg)
    result = run_backtest(
        data=df,
        strategy=make_strategy(cfg),
        risk_engine=make_risk_engine(cfg),
        execution_simulator=make_execution_simulator(cfg),
        config=cfg,
        output_dir=out,
    )
    return result.metrics, result.output_dir
