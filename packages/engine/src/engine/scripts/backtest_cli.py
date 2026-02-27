"""
Meridian backtest CLI — run full backtest and show a rich, visual summary.
Run: meridian-backtest [--out DIR]  or  python -m engine.scripts.backtest_cli
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.rule import Rule
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.text import Text
from rich import box

from engine.scripts.demo import run_demo

PACKAGE_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUT = PACKAGE_ROOT / "outputs" / "demo_run"

console = Console(force_terminal=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run full Meridian backtest (strategy → risk → execution) and print a rich summary.",
        epilog="Use --out apps/web/public/research/latest to update the web app artifacts.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output directory for artifacts",
    )
    args = parser.parse_args()

    console.print()
    console.print(Rule("[bold cyan]Meridian Backtest[/] — strategy → risk → execution → metrics", style="cyan"))
    console.print(Text.from_markup("  [dim]Synthetic data · Risk lab · Execution sim lab[/]"))
    console.print()

    with Progress(
        SpinnerColumn("dots", style="cyan"),
        TextColumn("[bold cyan]{task.description}[/]"),
        BarColumn(bar_width=20, style="cyan", complete_style="green", finished_style="bold green"),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Running pipeline…", total=100)
        run_path = run_demo(args.out)
        progress.update(task, completed=100)

    summary_path = run_path / "summary.json"
    if not summary_path.exists():
        console.print(Panel("[yellow]Backtest finished but summary.json not found.[/]", border_style="yellow", box=box.ROUNDED))
        return

    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    total_ret = summary.get("total_return_pct", 0) or 0
    max_dd = summary.get("max_drawdown_pct", 0) or 0
    win_rate = (summary.get("win_rate", 0) or 0) * 100
    sharpe = summary.get("sharpe")

    # Metrics table — key numbers with color
    metrics = Table(show_header=False, box=None, padding=(0, 2), expand=False)
    metrics.add_column(style="cyan", width=20)
    metrics.add_column(style="white", justify="right", width=14)
    metrics.add_row("Instrument", f"[bold]{summary.get('instrument', '—')}[/]")
    metrics.add_row("Timeframe", summary.get("timeframe", "—"))
    metrics.add_row("Start → End", f"[dim]{str(summary.get('start', ''))[:10]}[/] → [dim]{str(summary.get('end', ''))[:10]}[/]")
    metrics.add_row("Trades", f"[bold white]{summary.get('trades', '—')}[/]")
    metrics.add_row("Win rate", f"[{'green' if win_rate >= 50 else 'red'}]{win_rate:.1f}%[/]")
    metrics.add_row("Profit factor", f"{summary.get('profit_factor', 0):.2f}")
    metrics.add_row("Max drawdown", f"[bold red]{max_dd:.2f}%[/]")
    metrics.add_row("Total return", f"[bold green]{total_ret:.2f}%[/]")
    metrics.add_row("Sharpe (like)", f"[bold cyan]{sharpe:.2f}[/]" if sharpe is not None else "—")
    metrics.add_row("", "")
    risk = summary.get("risk") or {}
    metrics.add_row("[dim]Risk[/] daily loss %", str(risk.get("max_daily_loss_pct", "—")))
    metrics.add_row("[dim]Risk[/] kill switch %", str(risk.get("kill_switch_drawdown_pct", "—")))
    exec_ = summary.get("execution") or {}
    metrics.add_row("[dim]Execution[/] spread", str(exec_.get("spread_model", "—")))
    metrics.add_row("[dim]Execution[/] slippage", str(exec_.get("slippage_model", "—")))
    metrics.add_row("", "")
    metrics.add_row("Run at (UTC)", f"[dim]{str(summary.get('timestamp_utc', ''))[:19]}[/]")

    title = Text()
    title.append("  Backtest summary  ", style="bold white")
    title.append("  ✓ Complete  ", style="green")
    console.print(Panel(metrics, title=title, border_style="green", box=box.ROUNDED, padding=(1, 2)))
    console.print()
    console.print(Text.from_markup(f"  [dim]Artifacts:[/] [cyan]{run_path}[/]"))
    console.print(Text.from_markup("  [dim]Web:[/] Open [cyan]/research[/] → Run source: Unified | Risk Lab | Execution Sim"))
    console.print()
    console.print(Rule(style="dim"))
    console.print(Text.from_markup("  [dim]meridian-session[/] [dim]for session highs/lows ·[/] [cyan]meridian-backtest --out <dir>[/]"))
    console.print()


if __name__ == "__main__":
    main()
