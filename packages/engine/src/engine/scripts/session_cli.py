"""
Meridian session CLI — session summaries (Asia/London/NY), fair value gaps,
liquidity sweeps, and trade opportunities.
Run: meridian-session [SYMBOL...]  or  python -m engine.scripts.session_cli
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.rule import Rule
from rich.text import Text
from rich import box

from engine.session_analysis import run_session_analysis

console = Console(force_terminal=True)

DEFAULT_SYMBOLS = ["QQQ", "SPY", "GLD", "UUP"]
BLOCKS = "▁▂▃▄▅▆▇█"


def _get_history(symbol: str, period: str = "5d", interval: str = "1d"):
    import pandas as pd
    import yfinance as yf
    try:
        t = yf.Ticker(symbol)
        df = t.history(period=period, interval=interval)
        if df is None or df.empty or len(df) < 2:
            return None
        return df
    except Exception:
        return None


def _sparkline(closes: list[float], width: int = 24) -> str:
    if not closes:
        return ""
    mi, ma = min(closes), max(closes)
    if ma <= mi:
        return BLOCKS[0] * min(width, len(closes))
    out = []
    for c in closes[-width:]:
        pct = (float(c) - mi) / (ma - mi)
        idx = min(7, max(0, int(round(pct * 7))))
        out.append(BLOCKS[idx])
    return "".join(out)


def _format_predicting_ny(txt: str) -> Text:
    """Turn plain predicting_ny string into Rich Text with green/red for highs/lows."""
    if not txt:
        return Text()
    out = Text()
    for i, segment in enumerate(txt.split(" · ")):
        if i:
            out.append(" · ", style="dim")
        if "high " in segment and segment.strip().split()[-1].replace(".", "").isdigit():
            out.append(segment, style="green")
        elif "low " in segment and segment.strip().split()[-1].replace(".", "").isdigit():
            out.append(segment, style="red")
        elif "→" in segment or "Watch" in segment or "14:30" in segment:
            out.append(segment, style="bold cyan")
        else:
            out.append(segment, style="white")
    return out


def run_cli(symbols: list[str], compact: bool = False) -> None:
    console.print()
    console.print(Rule(
        "[bold cyan]Meridian Session[/] — Asia · London · NY · FVGs · Sweeps · Opportunities",
        style="cyan",
    ))
    console.print(Text.from_markup(
        f"  [dim]{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}[/]  [dim]·[/]  "
        "[cyan]meridian-session[/] [dim]QQQ SPY ...[/]"
    ))
    console.print()

    for sym in symbols:
        analysis = run_session_analysis(sym)
        if analysis is None:
            console.print(Panel(
                f"[red]✗ No data[/] for [bold]{sym}[/]",
                border_style="red",
                box=box.ROUNDED,
            ))
            console.print()
            continue

        # —— Daily summary ——
        ch = analysis.daily_change_pct
        ch_str = f"+{ch:.2f}%" if ch >= 0 else f"{ch:.2f}%"
        change_style = "bold green" if ch >= 0 else "bold red"
        arrow = "▲" if ch >= 0 else "▼"

        table = Table(show_header=False, box=None, padding=(0, 3), expand=False)
        table.add_column(style="cyan", width=16)
        table.add_column(style="white", justify="right", width=14)
        table.add_row("Daily high", f"[green]{analysis.daily_high:.2f}[/]")
        table.add_row("Daily low", f"[red]{analysis.daily_low:.2f}[/]")
        table.add_row("Open → Close", f"{analysis.daily_open:.2f} → [bold]{analysis.daily_close:.2f}[/]")
        table.add_row("Change", f"[{change_style}]{arrow} {ch_str}[/]")
        table.add_row("Pattern", f"[{analysis.pattern_color}]{analysis.pattern}[/]")
        table.add_row("Date", f"[dim]{analysis.date}[/]")

        # —— Session summary (Asia / London / NY) ——
        if analysis.session_levels:
            by_name: dict[str, list] = {}
            for s in analysis.session_levels:
                by_name.setdefault(s.name, []).append(s)
            # Show last occurrence of each session
            for label in ("Asia", "London", "NY"):
                sessions = by_name.get(label, [])
                if not sessions:
                    continue
                s = sessions[-1]
                table.add_row("", "")
                table.add_row(f"[bold]{label} high[/]", f"[green]{s.high:.2f}[/]")
                table.add_row(f"[bold]{label} low[/]", f"[red]{s.low:.2f}[/]")

        # —— Predicting in NY ——
        if analysis.predicting_ny:
            table.add_row("", "")
            table.add_row("[bold cyan]Predicting in NY[/]", "")
            # Render as multiple lines if needed
            pred_text = _format_predicting_ny(analysis.predicting_ny)
            table.add_row("", pred_text)

        # —— Fair value gaps ——
        if analysis.fvgs:
            table.add_row("", "")
            table.add_row("[bold yellow]Fair value gaps[/]", "")
            for fvg in analysis.fvgs[-3:]:
                if fvg.kind == "bullish":
                    table.add_row("  Bullish FVG", f"[green]{fvg.bottom:.2f} – {fvg.top:.2f}[/]")
                else:
                    table.add_row("  Bearish FVG", f"[red]{fvg.bottom:.2f} – {fvg.top:.2f}[/]")

        # —— Liquidity sweeps ——
        if analysis.sweeps:
            table.add_row("", "")
            table.add_row("[bold magenta]Liquidity sweeps[/]", "")
            for sw in analysis.sweeps[-2:]:
                if sw.kind == "low_sweep":
                    table.add_row("  Lows swept", f"[green]{sw.level:.2f}[/] (potential long)")
                else:
                    table.add_row("  Highs swept", f"[red]{sw.level:.2f}[/] (potential short)")

        # —— Opportunities / trade ideas ——
        if analysis.opportunities:
            table.add_row("", "")
            table.add_row("[bold green]Opportunities[/]", "")
            for opp in analysis.opportunities[:4]:
                table.add_row("  •", Text(opp, style="white", overflow="fold"))

        # Sparkline (1mo daily)
        if not compact:
            import pandas as pd
            df_1mo = _get_history(sym, period="1mo", interval="1d")
            if df_1mo is not None:
                closes = df_1mo["Close"].astype(float).tolist()
                sl = _sparkline(closes, width=min(28, len(closes)))
                up = len(closes) > 1 and closes[-1] >= closes[0]
                table.add_row("", "")
                table.add_row("[dim]Sparkline (1mo)[/]", Text(sl, style="green" if up else "red"))

        title = Text()
        title.append(f"  {analysis.symbol}  ", style="bold white")
        title.append(f"  {analysis.date}  ", style="dim")
        title.append(f"  [{analysis.interval}]  ", style="dim")
        console.print(Panel(
            table,
            title=title,
            border_style="bright_blue",
            box=box.ROUNDED,
            padding=(1, 2),
        ))
        console.print()

    console.print(Rule(style="dim"))
    console.print(Text.from_markup(
        "  [dim]Tip:[/] [cyan]meridian-session QQQ SPY[/]  [dim]|[/]  "
        "[cyan]meridian-backtest[/] [dim]for full backtest[/]"
    ))
    console.print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Meridian session CLI — Asia/London/NY session levels, FVGs, liquidity sweeps, trade ideas.",
        epilog="Examples:  meridian-session   meridian-session QQQ SPY   meridian-session --compact",
    )
    parser.add_argument(
        "symbols",
        nargs="*",
        default=DEFAULT_SYMBOLS,
        help="Symbols (default: QQQ SPY GLD UUP)",
    )
    parser.add_argument("-c", "--compact", action="store_true", help="Compact output, no sparkline")
    parser.add_argument("--json", action="store_true", help="Output analysis as JSON array (for API)")
    args = parser.parse_args()
    syms = [s.upper() for s in args.symbols]

    if args.json:
        import json
        from engine.session_analysis import analysis_to_dict
        out = []
        for s in syms:
            a = run_session_analysis(s)
            if a is not None:
                out.append(analysis_to_dict(a))
        console.print(json.dumps(out, allow_nan=False))
        return

    run_cli(syms, compact=args.compact)


if __name__ == "__main__":
    main()
