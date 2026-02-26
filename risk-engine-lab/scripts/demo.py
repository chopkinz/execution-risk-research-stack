from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys

import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from risk_engine_lab import MaxDailyLoss, MaxPositionSize, MaxTradesPerDay, RiskEngine


@dataclass
class DemoIntent:
    qty: float


@dataclass
class DemoPortfolio:
    trades_today: int
    daily_pnl: float
    equity: float
    drawdown_pct: float
    exposure: float


def run_demo() -> Path:
    out = ROOT / "outputs" / "demo_run"
    out.mkdir(parents=True, exist_ok=True)

    engine = RiskEngine(
        limits=[
            MaxPositionSize(max_qty=1.0),
            MaxTradesPerDay(max_trades=2),
            MaxDailyLoss(max_daily_loss_pct=0.02),
        ]
    )
    portfolio = DemoPortfolio(trades_today=0, daily_pnl=0.0, equity=100000.0, drawdown_pct=0.0, exposure=0.0)

    reasons: list[str] = []
    for i in range(6):
        intent = DemoIntent(qty=2.0 if i == 0 else 1.0)
        decision = engine.evaluate(intent, portfolio, {})
        if not decision.approved:
            reasons.extend(decision.reasons)
        else:
            portfolio.trades_today += 1
            portfolio.daily_pnl -= 300.0 if i == 4 else 0.0

    counts: dict[str, int] = {}
    for r in reasons:
        counts[r] = counts.get(r, 0) + 1

    equity = [100000, 100050, 100020, 99980, 99910]
    peak = []
    running = -10**18
    for v in equity:
        running = max(running, v)
        peak.append(running)
    dd = [(e - p) / p for e, p in zip(equity, peak)]

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(equity, color="#1a73e8")
    ax.set_title("Equity Curve (Risk Demo)")
    fig.tight_layout()
    fig.savefig(out / "equity_curve.png", dpi=140)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(dd, color="#d9534f")
    ax.set_title("Drawdown")
    fig.tight_layout()
    fig.savefig(out / "drawdown.png", dpi=140)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4))
    if counts:
        ax.bar(list(counts.keys()), list(counts.values()), color="#f0ad4e")
        ax.tick_params(axis="x", rotation=30)
    else:
        ax.bar(["none"], [1], color="#5bc0de")
    ax.set_title("Risk Rejections")
    fig.tight_layout()
    fig.savefig(out / "risk_rejections.png", dpi=140)
    plt.close(fig)

    report_lines = ["# risk-engine-lab Demo Report", "", "- offline deterministic risk evaluation demo"]
    for k, v in sorted(counts.items()):
        report_lines.append(f"- {k}: {v}")
    (out / "report.md").write_text("\n".join(report_lines), encoding="utf-8")
    return out


if __name__ == "__main__":
    run_demo()
