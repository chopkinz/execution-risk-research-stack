from __future__ import annotations

from pathlib import Path

from scripts.demo import run_demo


def test_demo_pipeline_generates_required_artifacts() -> None:
    run_dir = Path(run_demo())
    assert (run_dir / "equity_curve.png").exists()
    assert (run_dir / "drawdown.png").exists()
    assert (run_dir / "risk_rejections.png").exists()
    assert (run_dir / "report.md").exists()
