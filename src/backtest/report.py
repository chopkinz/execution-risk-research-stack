from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def build_report(output_dir: Path, trades: pd.DataFrame, equity_curve: pd.DataFrame, metrics: dict, mc_df: pd.DataFrame) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    trades.to_csv(output_dir / "trades.csv", index=False)
    equity_curve.to_csv(output_dir / "equity_curve.csv", index=False)
    pd.DataFrame([metrics]).to_csv(output_dir / "metrics.csv", index=False)
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    mc_df.to_csv(output_dir / "montecarlo.csv", index=False)

    if not equity_curve.empty:
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(pd.to_datetime(equity_curve["time"]), equity_curve["equity"], color="#1a73e8")
        ax.set_title("Equity Curve")
        fig.tight_layout()
        fig.savefig(output_dir / "equity_curve.png", dpi=140)
        plt.close(fig)

    if not trades.empty and "r_multiple" in trades.columns:
        rv = pd.to_numeric(trades["r_multiple"], errors="coerce").dropna()
        if not rv.empty:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.hist(rv, bins=min(20, max(5, len(rv))), color="#5b9cff", edgecolor="#ffffff")
            ax.set_title("R Distribution")
            fig.tight_layout()
            fig.savefig(output_dir / "r_distribution.png", dpi=140)
            plt.close(fig)

    lines = ["# Trading Buddy Tear Sheet", "", "## Metrics"]
    for k, v in metrics.items():
        lines.append(f"- **{k}**: {v}")
    lines += ["", "## Notes", "- Deterministic seed used for Monte Carlo resampling.", "- Execution costs include spread, slippage, fees, and optional latency."]
    (output_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")
