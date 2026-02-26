from __future__ import annotations

import copy
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

    _plot_drawdown(equity_csv, drawdown_png)
    _plot_risk_rejections(rejections_csv, rejections_png)

    required = [equity_png, drawdown_png, rejections_png, report_md]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"Demo failed, missing artifacts: {missing}")

    print("Demo complete")
    print(f"run_dir={run_path}")
    print(f"metrics={metrics}")
    return run_path


if __name__ == "__main__":
    run_demo()
