from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd


def build_report(
    output_dir: Path,
    trades: pd.DataFrame,
    equity_curve: pd.DataFrame,
    metrics: dict,
    mc_df: pd.DataFrame,
    rejection_rows: list[dict] | None = None,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    trades.to_csv(output_dir / "trades.csv", index=False)
    equity_curve.to_csv(output_dir / "equity_curve.csv", index=False)
    if not equity_curve.empty and "drawdown_pct" in equity_curve.columns:
        equity_curve[["time", "drawdown_pct"]].to_csv(output_dir / "drawdown.csv", index=False)
    pd.DataFrame([metrics]).to_csv(output_dir / "metrics.csv", index=False)
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    mc_df.to_csv(output_dir / "montecarlo.csv", index=False)

    # Monte Carlo drawdown distribution PNG (for Research UI Robustness tab)
    if not mc_df.empty and "max_drawdown_pct" in mc_df.columns:
        dd = pd.to_numeric(mc_df["max_drawdown_pct"], errors="coerce").dropna()
        if not dd.empty:
            fig, ax = plt.subplots(figsize=(9, 4))
            ax.hist(dd.values, bins=min(30, max(10, len(dd) // 10)), color="#1a73e8", edgecolor="#ffffff")
            ax.set_title("Monte Carlo Drawdown Distribution")
            ax.set_xlabel("Max Drawdown %")
            fig.tight_layout()
            fig.savefig(output_dir / "monte_carlo_dd.png", dpi=140)
            plt.close(fig)

    if not equity_curve.empty:
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(pd.to_datetime(equity_curve["time"]), equity_curve["equity"], color="#1a73e8")
        ax.set_title("Equity Curve")
        fig.tight_layout()
        fig.savefig(output_dir / "equity_curve.png", dpi=140)
        plt.close(fig)

        # Drawdown curve
        eq = pd.to_numeric(equity_curve["equity"], errors="coerce")
        rolling_max = eq.cummax()
        dd = (eq - rolling_max) / rolling_max.replace(0, pd.NA)
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.fill_between(range(len(dd)), dd.fillna(0.0).values, 0, color="#d9534f", alpha=0.7)
        ax.set_title("Drawdown")
        ax.set_ylabel("Drawdown")
        fig.tight_layout()
        fig.savefig(output_dir / "drawdown.png", dpi=140)
        plt.close(fig)

    # Risk rejections bar chart
    rej = rejection_rows or []
    if rej:
        rej_df = pd.DataFrame(rej)
        counts = rej_df["reason"].value_counts() if "reason" in rej_df.columns else pd.Series(dtype=int)
    else:
        counts = pd.Series(dtype=int)
    fig, ax = plt.subplots(figsize=(9, 4))
    if counts.empty:
        ax.bar(["none"], [1], color="#5bc0de")
        ax.set_title("Risk Rejections (none)")
    else:
        ax.bar(counts.index.astype(str), counts.values, color="#f0ad4e")
        ax.set_title("Risk Rejections")
        ax.tick_params(axis="x", rotation=30)
    fig.tight_layout()
    fig.savefig(output_dir / "risk_rejections.png", dpi=140)
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

    lines = ["# Tear Sheet", "", "## Metrics"]
    for k, v in metrics.items():
        lines.append(f"- **{k}**: {v}")
    lines += ["", "## Notes", "- Deterministic seed used for Monte Carlo resampling.", "- Execution costs include spread, slippage, fees, and optional latency."]
    (output_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")

    # report.html for browser viewing
    rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in metrics.items())
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Run Report</title>
<style>body{{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}} table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #ddd;padding:8px;text-align:left}} th{{background:#f5f5f5}}</style>
</head>
<body>
<h1>Tear Sheet</h1>
<h2>Metrics</h2>
<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>{rows}</tbody></table>
<p><small>Deterministic seed used for Monte Carlo. Execution costs include spread, slippage, fees, latency.</small></p>
</body>
</html>"""
    (output_dir / "report.html").write_text(html, encoding="utf-8")
