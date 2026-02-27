"""Run execution-sim-lab demo: fill simulation with spread, slippage, latency."""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from engine.execution.sim_lab import (
    ExecutionSimulator,
    LatencyModel,
    OrderIntent,
    Side,
    SlippageModel,
    SpreadModel,
)


def run_execution_lab_demo(out: Path) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    sim = ExecutionSimulator(
        spread_model=SpreadModel(min_spread=0.1, spread_bps=0.0),
        slippage_model=SlippageModel(k_vol=0.05),
        latency_model=LatencyModel(delay_bars=1),
        fee_bps=1.0,
    )
    mid_prices = [100.0, 100.5, 101.2, 100.8, 102.0]
    fills = []
    for i, mid in enumerate(mid_prices):
        intent = OrderIntent(
            symbol="SYNTH",
            side=Side.BUY if i % 2 == 0 else Side.SELL,
            qty=1.0,
            timestamp=pd.Timestamp("2026-01-01", tz="UTC") + pd.Timedelta(minutes=15 * i),
            bar_index=i,
        )
        fills.extend(
            sim.simulate_fills([intent], {"mid_price": mid, "volatility": 0.01})
        )
    df = pd.DataFrame(
        [
            {
                "time": f.timestamp,
                "side": f.side.value,
                "fill_price": f.fill_price,
                "fees": f.fees,
                "slippage": f.slippage,
                "bar_index": f.bar_index,
            }
            for f in fills
        ]
    )
    df.to_csv(out / "fills.csv", index=False)
    equity = 10000.0 + (pd.Series(range(len(df))) * 2.0) - df["fees"].cumsum()
    dd = (equity - equity.cummax()) / equity.cummax()
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(equity.values, color="#1a73e8")
    ax.set_title("Equity Curve (Execution Sim Lab Demo)")
    fig.tight_layout()
    fig.savefig(out / "equity_curve.png", dpi=140)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(dd.fillna(0.0).values, color="#d9534f")
    ax.set_title("Drawdown")
    fig.tight_layout()
    fig.savefig(out / "drawdown.png", dpi=140)
    plt.close(fig)
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(["none"], [0], color="#5bc0de")
    ax.set_title("Risk Rejections")
    fig.tight_layout()
    fig.savefig(out / "risk_rejections.png", dpi=140)
    plt.close(fig)
    (out / "report.md").write_text(
        "\n".join(
            [
                "# execution-sim-lab Demo Report",
                "",
                "- Offline deterministic fill simulation (spread, slippage, latency).",
                f"- Fills generated: {len(df)}",
            ]
        ),
        encoding="utf-8",
    )
    return out
