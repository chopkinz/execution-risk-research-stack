from __future__ import annotations

from pathlib import Path

from scripts.demo import run_demo


def test_demo_artifacts_exist() -> None:
    out = Path(run_demo())
    assert (out / "equity_curve.png").exists()
    assert (out / "drawdown.png").exists()
    assert (out / "risk_rejections.png").exists()
    assert (out / "report.md").exists()
