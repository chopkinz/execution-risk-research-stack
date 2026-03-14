from __future__ import annotations

import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.backtest.runner import run_from_config
from src.core.config import load_config
from src.data.synthetic import generate_synthetic_ohlcv

DEMO_OUT = ROOT / "outputs" / "demo_run"


def _plot_drawdown(equity_csv: Path, output_png: Path) -> None:
    eq = pd.read_csv(equity_csv)
    eq["equity"] = pd.to_numeric(eq["equity"], errors="coerce")
    rolling_max = eq["equity"].cummax()
    dd = (eq["equity"] - rolling_max) / rolling_max.replace(0, pd.NA)
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.plot(dd.fillna(0.0).values, color="#d9534f")
    ax.set_title("Drawdown")
    ax.set_ylabel("Drawdown")
    fig.tight_layout()
    fig.savefig(output_png, dpi=140)
    plt.close(fig)


def _plot_monte_carlo_dd(montecarlo_csv: Path, output_png: Path) -> None:
    mc = pd.read_csv(montecarlo_csv) if montecarlo_csv.exists() else pd.DataFrame(columns=["max_drawdown_pct"])
    dd = pd.to_numeric(mc.get("max_drawdown_pct", pd.Series(dtype=float)), errors="coerce").dropna()
    if dd.empty:
        return
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.hist(dd.values, bins=min(30, max(10, len(dd) // 10)), color="#1a73e8", edgecolor="#ffffff")
    ax.set_title("Monte Carlo Drawdown Distribution")
    ax.set_xlabel("Max Drawdown %")
    fig.tight_layout()
    fig.savefig(output_png, dpi=140)
    plt.close(fig)


def _plot_risk_rejections(rejections_csv: Path, output_png: Path) -> None:
    rej = pd.read_csv(rejections_csv) if rejections_csv.exists() else pd.DataFrame(columns=["reason"])
    counts = rej["reason"].value_counts() if "reason" in rej.columns else pd.Series(dtype=int)
    fig, ax = plt.subplots(figsize=(9, 4))
    if counts.empty:
        ax.bar(["none"], [1], color="#5bc0de")
        ax.set_title("Risk Rejections (none)")
    else:
        ax.bar(counts.index.astype(str), counts.values, color="#f0ad4e")
        ax.set_title("Risk Rejections")
        ax.tick_params(axis="x", rotation=30)
    fig.tight_layout()
    fig.savefig(output_png, dpi=140)
    plt.close(fig)


def _to_iso_utc(value: str | None) -> str:
    if not value:
        return ""
    ts = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(ts):
        return ""
    return ts.to_pydatetime().isoformat()


def _build_summary(cfg: dict, run_path: Path, metrics: dict) -> dict:
    equity = pd.read_csv(run_path / "equity_curve.csv") if (run_path / "equity_curve.csv").exists() else pd.DataFrame()
    trades = int(metrics.get("trades", 0))
    start = _to_iso_utc(str(equity["time"].iloc[0])) if not equity.empty else ""
    end = _to_iso_utc(str(equity["time"].iloc[-1])) if not equity.empty else ""

    initial_cash = float(cfg["portfolio"]["initial_cash"])
    end_equity = float(pd.to_numeric(equity["equity"], errors="coerce").dropna().iloc[-1]) if not equity.empty else initial_cash
    total_return_pct = ((end_equity - initial_cash) / initial_cash) * 100.0 if initial_cash else 0.0

    cagr_pct: float | None = None
    if start and end:
        start_ts = pd.to_datetime(start, utc=True)
        end_ts = pd.to_datetime(end, utc=True)
        years = (end_ts - start_ts).total_seconds() / (365.25 * 24 * 3600)
        if years > 0 and initial_cash > 0 and end_equity > 0:
            cagr_pct = ((end_equity / initial_cash) ** (1.0 / years) - 1.0) * 100.0

    sharpe_val = metrics.get("sharpe_like")
    sharpe: float | None = float(sharpe_val) if sharpe_val is not None else None

    summary = {
        "run_id": "demo_run",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "instrument": cfg["symbol"],
        "timeframe": cfg["interval"],
        "start": start,
        "end": end,
        "trades": trades,
        "win_rate": float(metrics.get("win_rate", 0.0)),
        "profit_factor": float(metrics.get("profit_factor", 0.0)),
        "max_drawdown_pct": float(metrics.get("max_drawdown_pct", 0.0)),
        "sharpe": sharpe,
        "total_return_pct": float(total_return_pct),
        "cagr_pct": float(cagr_pct) if cagr_pct is not None else None,
        "notes": "Deterministic offline synthetic demo run.",
        "risk": {
            "max_daily_loss_pct": float(cfg["risk"]["max_daily_loss_pct"]),
            "max_exposure_pct": float(cfg["risk"]["max_gross_exposure"]) / initial_cash * 100.0 if initial_cash else 0.0,
            "kill_switch_drawdown_pct": float(cfg["risk"]["max_drawdown_pct"]),
        },
        "execution": {
            "spread_model": "bps_plus_min_spread",
            "slippage_model": "volatility_scaled_linear",
            "fees_model": "fee_bps",
        },
    }
    return summary


def run_demo() -> Path:
    cfg = load_config(ROOT / "configs" / "nas100_momentum.yaml")
    cfg = copy.deepcopy(cfg)
    cfg["symbol"] = "SYNTH_NDX"
    cfg["seed"] = 42
    cfg["period"] = "offline_demo"

    data = generate_synthetic_ohlcv(seed=int(cfg["seed"]))
    DEMO_OUT.mkdir(parents=True, exist_ok=True)
    metrics, run_dir = run_from_config(ROOT, cfg, data=data, output_dir=DEMO_OUT)

    run_path = Path(run_dir)
    equity_csv = run_path / "equity_curve.csv"
    rejections_csv = run_path / "risk_rejections.csv"
    report_md = run_path / "report.md"
    equity_png = run_path / "equity_curve.png"
    drawdown_png = run_path / "drawdown.png"
    rejections_png = run_path / "risk_rejections.png"
    monte_carlo_dd_png = run_path / "monte_carlo_dd.png"
    montecarlo_csv = run_path / "montecarlo.csv"

    _plot_drawdown(equity_csv, drawdown_png)
    _plot_risk_rejections(rejections_csv, rejections_png)
    _plot_monte_carlo_dd(montecarlo_csv, monte_carlo_dd_png)

    summary = _build_summary(cfg, run_path, metrics)
    (run_path / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    required = [equity_png, drawdown_png, rejections_png, report_md, run_path / "summary.json"]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"Demo failed, missing artifacts: {missing}")

    print("Demo complete")
    print(f"run_dir={run_path}")
    print(f"metrics={metrics}")
    return run_path


if __name__ == "__main__":
    run_demo()
