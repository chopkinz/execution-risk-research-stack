from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from engine.backtest.engine import run_backtest
from engine.data.loaders import YahooRequest, load_yahoo
from engine.data.storage import ensure_dirs
from engine.execution.latency import LatencyModel
from engine.execution.simulator import ExecutionSimulator
from engine.execution.slippage import SlippageModel
from engine.execution.spread import SpreadModel
from engine.risk.engine import RiskEngine
from engine.risk.limits import MaxDailyLoss, MaxDrawdown, MaxGrossExposure, MaxPositionSize, MaxTradesPerDay
from engine.strategy.examples.momentum_strategy import MomentumStrategy


def make_strategy(cfg: dict[str, Any]) -> MomentumStrategy:
    return MomentumStrategy(
        symbol=cfg["symbol"],
        threshold=float(cfg["strategy"]["threshold"]),
        qty=float(cfg["strategy"]["qty"]),
    )


def make_risk_engine(cfg: dict[str, Any]) -> RiskEngine:
    return RiskEngine(
        limits=[
            MaxPositionSize(cfg["risk"]["max_position_size"]),
            MaxTradesPerDay(cfg["risk"]["max_trades_per_day"]),
            MaxDailyLoss(cfg["risk"]["max_daily_loss_pct"]),
            MaxDrawdown(cfg["risk"]["max_drawdown_pct"]),
            MaxGrossExposure(cfg["risk"]["max_gross_exposure"]),
        ]
    )


def make_execution_simulator(cfg: dict[str, Any]) -> ExecutionSimulator:
    return ExecutionSimulator(
        spread_model=SpreadModel(min_spread=cfg["execution"]["min_spread"], spread_bps=cfg["execution"]["spread_bps"]),
        slippage_model=SlippageModel(k_vol=cfg["execution"]["slippage_k"]),
        latency_model=LatencyModel(delay_bars=cfg["execution"]["delay_bars"]),
        fee_bps=cfg["execution"]["fee_bps"],
    )


def load_data_from_config(root: Path, cfg: dict[str, Any], force_refresh: bool = False) -> pd.DataFrame:
    dirs = ensure_dirs(root)
    return load_yahoo(
        YahooRequest(
            symbol=cfg["symbol"],
            interval=cfg["interval"],
            period=cfg.get("period"),
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
