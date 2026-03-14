from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

from engine.backtest.metrics import compute_metrics
from engine.backtest.montecarlo import monte_carlo_trade_resample
from engine.backtest.report import build_report
from engine.core.clock import date_key
from engine.core.logger import configure_logger
from engine.core.models import Bar, RiskEvent
from engine.core.types import BacktestResult, PortfolioState
from engine.execution.simulator import ExecutionSimulator
from engine.features.pipeline import build_features
from engine.portfolio.accounting import apply_fills
from engine.risk.engine import RiskEngine
from engine.strategy.base import Strategy


def _run_id(config: dict, data: pd.DataFrame) -> str:
    """Deterministic run id from config and data fingerprint."""
    cfg_str = json.dumps(config, sort_keys=True, default=str)
    if data.empty:
        data_fp = "empty"
    else:
        t0 = str(data["time"].iloc[0]) if "time" in data.columns else ""
        t1 = str(data["time"].iloc[-1]) if "time" in data.columns else ""
        data_fp = f"{data.shape[0]}_{t0}_{t1}"
    h = hashlib.sha256((cfg_str + data_fp).encode()).hexdigest()
    return h[:16]


def run_backtest(
    data: pd.DataFrame,
    strategy: Strategy,
    risk_engine: RiskEngine,
    execution_simulator: ExecutionSimulator,
    config: dict,
    output_dir: Path,
) -> BacktestResult:
    seed = int(config.get("seed", 42))
    np.random.seed(seed)
    run_id = _run_id(config, data)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger = configure_logger(output_dir / "run.log")

    # Annotations for chart overlays (FVG, sessions, structure)
    try:
        from engine.signals.fvg import detect_fvgs
        from engine.signals.structure import detect_structure
        from engine.sessions.engine import compute_sessions
        fvgs = [a.to_dict() for a in detect_fvgs(data)]
        structure = [a.to_dict() for a in detect_structure(data)]
        sessions = [a.to_dict() for a in compute_sessions(data)]
        annotations = {"run_id": run_id, "fvgs": fvgs, "structure": structure, "sessions": sessions}
        (output_dir / "annotations.json").write_text(json.dumps(annotations, indent=2, default=str), encoding="utf-8")
    except Exception as e:
        logger.warning("annotations_skip error=%s", e)

    feats = build_features(
        data,
        session_start=config["session"]["start"],
        session_end=config["session"]["end"],
    ).reset_index(drop=True)
    feats["bar_index"] = feats.index
    if hasattr(strategy, "prepare"):
        strategy.prepare(feats)

    state = PortfolioState(
        cash=float(config["portfolio"]["initial_cash"]),
        equity=float(config["portfolio"]["initial_cash"]),
        positions={},
        peak_equity=float(config["portfolio"]["initial_cash"]),
    )

    symbol = config.get("symbol", "")
    trade_rows: list[dict] = []
    equity_rows: list[dict] = []
    risk_events: list[RiskEvent] = []

    for i, row in feats.iterrows():
        bar = Bar.from_series(row, symbol=symbol, bar_index=i)
        intents = strategy.on_bar(bar, row, state)
        approved_intents: list = []
        for intent in intents:
            decision = risk_engine.evaluate(intent, state, {"row": row})
            if decision.approved:
                approved_intents.append(intent)
            else:
                reason = "|".join(decision.reasons)
                risk_events.append(
                    RiskEvent(time=bar.time, symbol=intent.symbol, reason=reason, bar_index=bar.bar_index)
                )
                logger.info("risk_reject symbol=%s reason=%s", intent.symbol, reason)

        fills = execution_simulator.simulate_fills(
            approved_intents,
            market_context={"mid_price": bar.close, "volatility": float(abs(row.get("ret_1", 0.001)))},
        )
        if fills:
            prev_realized = sum(p.realized_pnl for p in state.positions.values()) if state.positions else 0.0
            state = apply_fills(fills, state, mark_price=bar.close, current_date=date_key(row["time_ct"]))
            new_realized = sum(p.realized_pnl for p in state.positions.values()) if state.positions else 0.0
            realized_delta = new_realized - prev_realized
            for f in fills:
                trade_rows.append(
                    {
                        "time": bar.time,
                        "entry_time": bar.time,
                        "exit_time": bar.time,
                        "symbol": f.symbol,
                        "direction": f.side.value,
                        "qty": f.qty,
                        "entry_price": f.fill_price,
                        "exit_price": f.fill_price,
                        "pnl": realized_delta - f.fees,
                        "r_multiple": 0.0,
                        "fees": f.fees,
                        "slippage": f.slippage,
                        "reason": f.metadata.get("signal", "fill"),
                    }
                )
                logger.info(
                    "fill symbol=%s side=%s qty=%.4f px=%.5f fee=%.5f slip=%.5f",
                    f.symbol,
                    f.side.value,
                    f.qty,
                    f.fill_price,
                    f.fees,
                    f.slippage,
                )

        equity_rows.append(
            {"time": bar.time, "date": date_key(row["time_ct"]), "equity": state.equity, "drawdown_pct": state.drawdown_pct}
        )

    if hasattr(strategy, "finalize"):
        strategy.finalize()

    trades = pd.DataFrame(trade_rows)
    equity_curve = pd.DataFrame(equity_rows)
    metrics = compute_metrics(trades, equity_curve, initial_equity=float(config["portfolio"]["initial_cash"]))
    mc_df = monte_carlo_trade_resample(trades=trades, initial_equity=float(config["portfolio"]["initial_cash"]), n_paths=int(config.get("montecarlo_paths", 500)), seed=seed)
    rejection_rows = [e.to_dict() for e in risk_events]
    pd.DataFrame(rejection_rows).to_csv(output_dir / "risk_rejections.csv", index=False)
    (output_dir / "risk_log.json").write_text(
        json.dumps({"run_id": run_id, "rejections": rejection_rows}, indent=2, default=str),
        encoding="utf-8",
    )
    (output_dir / "run_id.txt").write_text(run_id, encoding="utf-8")
    feats.to_csv(output_dir / "candles_with_features.csv", index=False)
    data.to_csv(output_dir / "ohlcv.csv", index=False)
    build_report(output_dir, trades, equity_curve, metrics, mc_df, rejection_rows=rejection_rows)

    # summary.json for web/API
    start_ts = str(equity_curve["time"].iloc[0]) if not equity_curve.empty else ""
    end_ts = str(equity_curve["time"].iloc[-1]) if not equity_curve.empty else ""
    initial_cash = float(config["portfolio"]["initial_cash"])
    end_equity = float(equity_curve["equity"].iloc[-1]) if not equity_curve.empty else initial_cash
    total_return_pct = ((end_equity - initial_cash) / initial_cash) * 100.0 if initial_cash else 0.0
    risk_cfg = config.get("risk", {})
    max_gross = risk_cfg.get("max_gross_exposure")
    max_dd_limit = risk_cfg.get("max_drawdown_pct")
    max_exposure_pct = (float(max_gross) / initial_cash * 100.0) if max_gross is not None and initial_cash else None

    summary = {
        "run_id": run_id,
        "timestamp_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "instrument": config.get("symbol", ""),
        "timeframe": config.get("interval", ""),
        "start": start_ts,
        "end": end_ts,
        "trades": int(metrics.get("trades", 0)),
        "win_rate": float(metrics.get("win_rate", 0.0)),
        "profit_factor": float(metrics.get("profit_factor", 0.0)),
        "max_drawdown_pct": float(metrics.get("max_drawdown_pct", 0.0)),
        "sharpe": metrics.get("sharpe_like"),
        "total_return_pct": total_return_pct,
        "risk": {
            "max_daily_loss_pct": risk_cfg.get("max_daily_loss_pct"),
            "max_gross_exposure": max_gross,
            "max_drawdown_pct": max_dd_limit,
            "max_exposure_pct": max_exposure_pct,
            "kill_switch_drawdown_pct": max_dd_limit,
        },
        "execution": config.get("execution", {}),
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2, default=str), encoding="utf-8")

    return BacktestResult(
        trades=trades,
        equity_curve=equity_curve,
        metrics=metrics,
        config_used=asdict(config) if hasattr(config, "__dataclass_fields__") else config,
        logs_path=str(output_dir / "run.log"),
        output_dir=str(output_dir),
    )
