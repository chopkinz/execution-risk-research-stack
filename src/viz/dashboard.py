from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st


def main() -> None:
    st.set_page_config(page_title="Trading Buddy", page_icon=":material/monitoring:", layout="wide")
    root = Path(__file__).resolve().parents[2]
    outputs = root / "outputs"
    runs = sorted([p for p in outputs.glob("*") if p.is_dir()], reverse=True)

    st.title("TRADING BUDDY")
    st.caption("Trading Made Simple.")
    if not runs:
        st.info("No runs available.")
        return
    selected = st.selectbox("Run", runs, format_func=lambda p: p.name)

    metrics = pd.read_csv(selected / "metrics.csv") if (selected / "metrics.csv").exists() else pd.DataFrame()
    trades = pd.read_csv(selected / "trades.csv") if (selected / "trades.csv").exists() else pd.DataFrame()
    eq = pd.read_csv(selected / "equity_curve.csv") if (selected / "equity_curve.csv").exists() else pd.DataFrame()
    candles = pd.read_csv(selected / "candles_with_features.csv") if (selected / "candles_with_features.csv").exists() else pd.DataFrame()

    if not metrics.empty:
        m = metrics.iloc[0]
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("Net Profit", f"${float(m.get('net_pnl', 0)):,.2f}")
        c2.metric("Win Rate", f"{100*float(m.get('win_rate', 0)):.1f}%")
        c3.metric("Avg R", f"{float(m.get('avg_r', 0)):.2f}")
        c4.metric("Expectancy", f"{float(m.get('expectancy_r', 0)):.2f}")
        c5.metric("Max Drawdown", f"{float(m.get('max_drawdown_pct', 0)):.2f}%")
        c6.metric("Profit Factor", f"{float(m.get('profit_factor', 0)):.2f}")

    tabs = st.tabs(["Overview", "Chart", "Trades"])
    with tabs[0]:
        if not eq.empty:
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=pd.to_datetime(eq["time"]), y=eq["equity"], mode="lines", name="Equity"))
            fig.update_layout(template="plotly_white", height=360)
            st.plotly_chart(fig, use_container_width=True)
    with tabs[1]:
        if not candles.empty:
            c = candles.copy()
            c["time"] = pd.to_datetime(c["time"])
            fig = go.Figure(
                data=[
                    go.Candlestick(
                        x=c["time"],
                        open=c["open"],
                        high=c["high"],
                        low=c["low"],
                        close=c["close"],
                    )
                ]
            )
            fig.update_layout(template="plotly_white", height=520)
            st.plotly_chart(fig, use_container_width=True)
    with tabs[2]:
        if trades.empty:
            st.info("No trades.")
        else:
            st.dataframe(trades, use_container_width=True)


if __name__ == "__main__":
    main()
