from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd

from src.backtest.metrics import compute_metrics
from src.backtest.montecarlo import monte_carlo_trade_resample
from src.backtest.report import build_report
from src.core.clock import date_key
from src.core.logger import configure_logger
from src.core.types import BacktestResult, PortfolioState
from src.execution.simulator import ExecutionSimulator
from src.features.pipeline import build_features
from src.portfolio.accounting import apply_fills
from src.risk.engine import RiskEngine
from src.strategy.base import Strategy


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

    logger = configure_logger(output_dir / "run.log")
    feats = build_features(
        data,
        session_start=config["session"]["start"],
        session_end=config["session"]["end"],
    ).reset_index(drop=True)
    feats["bar_index"] = feats.index

    state = PortfolioState(
        cash=float(config["portfolio"]["initial_cash"]),
        equity=float(config["portfolio"]["initial_cash"]),
        positions={},
        peak_equity=float(config["portfolio"]["initial_cash"]),
    )

    trade_rows: list[dict] = []
    equity_rows: list[dict] = []
    rejection_rows: list[dict] = []

    for i, row in feats.iterrows():
        intents = strategy.on_bar(row, row, state)
        approved_intents = []
        for intent in intents:
            decision = risk_engine.evaluate(intent, state, {"row": row})
            if decision.approved:
                approved_intents.append(intent)
            else:
                rejection_rows.append({"time": row["time"], "symbol": intent.symbol, "reason": "|".join(decision.reasons)})
                logger.info("risk_reject symbol=%s reason=%s", intent.symbol, "|".join(decision.reasons))

        fills = execution_simulator.simulate_fills(
            approved_intents,
            market_context={"mid_price": float(row["close"]), "volatility": float(abs(row.get("ret_1", 0.001)))},
        )
        if fills:
            prev_realized = sum(p.realized_pnl for p in state.positions.values()) if state.positions else 0.0
            state = apply_fills(fills, state, mark_price=float(row["close"]), current_date=date_key(row["time_ct"]))
            new_realized = sum(p.realized_pnl for p in state.positions.values()) if state.positions else 0.0
            realized_delta = new_realized - prev_realized
            for f in fills:
                trade_rows.append(
                    {
                        "time": row["time"],
                        "entry_time": row["time"],
                        "exit_time": row["time"],
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

        equity_rows.append({"time": row["time"], "date": date_key(row["time_ct"]), "equity": state.equity, "drawdown_pct": state.drawdown_pct})

    trades = pd.DataFrame(trade_rows)
    equity_curve = pd.DataFrame(equity_rows)
    metrics = compute_metrics(trades, equity_curve, initial_equity=float(config["portfolio"]["initial_cash"]))
    mc_df = monte_carlo_trade_resample(trades=trades, initial_equity=float(config["portfolio"]["initial_cash"]), n_paths=int(config.get("montecarlo_paths", 500)), seed=seed)
    pd.DataFrame(rejection_rows).to_csv(output_dir / "risk_rejections.csv", index=False)
    feats.to_csv(output_dir / "candles_with_features.csv", index=False)
    build_report(output_dir, trades, equity_curve, metrics, mc_df)

    return BacktestResult(
        trades=trades,
        equity_curve=equity_curve,
        metrics=metrics,
        config_used=asdict(config) if hasattr(config, "__dataclass_fields__") else config,
        logs_path=str(output_dir / "run.log"),
        output_dir=str(output_dir),
    )
