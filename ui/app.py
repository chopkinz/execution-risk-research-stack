from __future__ import annotations

from pathlib import Path
import sys

import pandas as pd
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from scripts.demo import run_demo


def _safe_read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except Exception:
        return pd.DataFrame()


def main() -> None:
    st.set_page_config(page_title="Execution Risk Research Stack", layout="wide")
    st.title("Execution Risk Research Stack")
    st.caption("Offline deterministic demo runner and artifact viewer.")

    if st.button("Run Demo", type="primary"):
        with st.spinner("Running offline demo pipeline..."):
            run_path = run_demo()
        st.success(f"Demo run complete: {run_path}")

    demo_dir = ROOT / "outputs" / "demo_run"
    c1, c2, c3 = st.columns(3)
    c1.image(str(demo_dir / "equity_curve.png"), caption="Equity Curve")
    c2.image(str(demo_dir / "drawdown.png"), caption="Drawdown")
    c3.image(str(demo_dir / "risk_rejections.png"), caption="Risk Rejections")

    st.subheader("Report")
    report = demo_dir / "report.md"
    if report.exists():
        st.markdown(report.read_text(encoding="utf-8"))
    else:
        st.info("Run demo to generate report.")

    st.subheader("Risk Rejections Table")
    st.dataframe(_safe_read_csv(demo_dir / "risk_rejections.csv"), use_container_width=True)

    st.subheader("Run Logs")
    run_log = demo_dir / "run.log"
    if run_log.exists():
        st.code(run_log.read_text(encoding="utf-8"), language="text")
    else:
        st.info("No run log found yet.")


if __name__ == "__main__":
    main()
