"""
Meridian CLI — single entry point: data fetch, sessions, annotate, simulate, report.

Usage:
  meridian data fetch [--symbol SYMBOL] [--interval 15m] [--period 60d] [--out DIR]
  meridian sessions [SYMBOLS...]
  meridian annotate --config CONFIG [--out DIR]
  meridian simulate --config CONFIG [--out DIR]
  meridian report --dir RUN_DIR

Same configs as web. Same artifact bundle. Rich output for SSH/phone.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console(force_terminal=True)


def _package_root() -> Path:
    return Path(__file__).resolve().parents[2]


def cmd_data_fetch(args: argparse.Namespace) -> int:
    from engine.data.loaders import YahooRequest, load_yahoo
    from engine.data.providers import SYMBOL_PRESETS, load_with_preset
    from engine.data.storage import ensure_dirs

    root = Path(args.root) if args.root else _package_root()
    dirs = ensure_dirs(root)
    symbol = args.symbol or "^NDX"
    interval = args.interval or "15m"
    period = args.period or "60d"
    try:
        if symbol.strip().upper() in SYMBOL_PRESETS:
            df = load_with_preset(symbol=symbol, interval=interval, period=period, cache_dir=dirs["data"], force_refresh=bool(args.refresh))
        else:
            df = load_yahoo(YahooRequest(symbol=symbol, interval=interval, period=period, force_refresh=bool(args.refresh)), cache_dir=dirs["data"])
    except Exception as e:
        console.print(f"[red]Fetch failed:[/] {e}")
        return 1
    tbl = Table(title="Data fetch")
    tbl.add_column("Rows", justify="right", style="cyan")
    tbl.add_column("Symbol")
    tbl.add_column("Interval")
    tbl.add_column("From", style="dim")
    tbl.add_column("To", style="dim")
    tbl.add_row(str(len(df)), symbol, interval, str(df["time"].iloc[0])[:19] if len(df) else "—", str(df["time"].iloc[-1])[:19] if len(df) else "—")
    console.print(tbl)
    if args.out:
        Path(args.out).mkdir(parents=True, exist_ok=True)
        df.to_csv(Path(args.out) / "ohlcv.csv", index=False)
        console.print(f"[dim]Saved ohlcv.csv to {args.out}[/]")
    return 0


def cmd_sessions(args: argparse.Namespace) -> int:
    from engine.scripts import session_cli
    sys.argv = ["session_cli"] + (args.symbols or ["QQQ", "SPY"])
    session_cli.main()
    return 0


def cmd_annotate(args: argparse.Namespace) -> int:
    from engine.core.config import load_config
    from engine.data.loaders import YahooRequest, load_yahoo
    from engine.data.providers import SYMBOL_PRESETS, load_with_preset
    from engine.data.storage import ensure_dirs
    from engine.signals.fvg import detect_fvgs
    from engine.signals.structure import detect_structure
    from engine.sessions.engine import compute_sessions

    config_path = Path(args.config)
    if not config_path.exists():
        console.print(f"[red]Config not found:[/] {config_path}")
        return 1
    cfg = load_config(config_path)
    root = Path(args.root) if args.root else config_path.resolve().parent
    dirs = ensure_dirs(root)
    symbol = cfg.get("symbol", "^NDX")
    interval = cfg.get("interval", "15m")
    period = cfg.get("period", "60d")
    try:
        if symbol.strip().upper() in SYMBOL_PRESETS:
            df = load_with_preset(symbol=symbol, interval=interval, period=period, cache_dir=dirs["data"])
        else:
            df = load_yahoo(YahooRequest(symbol=symbol, interval=interval, period=period), cache_dir=dirs["data"])
    except Exception as e:
        console.print(f"[red]Load failed:[/] {e}")
        return 1
    fvgs = [a.to_dict() for a in detect_fvgs(df)]
    structure = [a.to_dict() for a in detect_structure(df)]
    sessions = [a.to_dict() for a in compute_sessions(df)]
    out_dir = Path(args.out) if args.out else root / "outputs" / "annotate"
    out_dir.mkdir(parents=True, exist_ok=True)
    annotations = {"run_id": "annotate", "fvgs": fvgs, "structure": structure, "sessions": sessions}
    (out_dir / "annotations.json").write_text(json.dumps(annotations, indent=2, default=str), encoding="utf-8")
    t = Table(title="Annotations")
    t.add_column("Type", style="cyan")
    t.add_column("Count", justify="right")
    t.add_row("FVG", str(len(fvgs)))
    t.add_row("Structure", str(len(structure)))
    t.add_row("Sessions", str(len(sessions)))
    console.print(t)
    console.print(f"[dim]Written {out_dir / 'annotations.json'}[/]")
    return 0


def cmd_simulate(args: argparse.Namespace) -> int:
    from engine.backtest.runner import run_from_config
    from engine.core.config import load_config

    config_path = Path(args.config)
    if not config_path.exists():
        console.print(f"[red]Config not found:[/] {config_path}")
        return 1
    cfg = load_config(config_path)
    root = Path(args.root) if args.root else config_path.resolve().parent
    out_path = Path(args.out) if args.out else root / "outputs" / "simulate"
    out_path.mkdir(parents=True, exist_ok=True)
    try:
        metrics, run_dir = run_from_config(root, cfg, output_dir=out_path)
        t = Table(title="Simulate")
        t.add_column("Metric", style="cyan")
        t.add_column("Value", justify="right")
        for k, v in metrics.items():
            t.add_row(k, str(v))
        console.print(Panel(t, title="Metrics", border_style="green"))
        console.print(f"[dim]Artifacts: {run_dir}[/]")
        return 0
    except Exception as e:
        console.print(f"[red]Simulate failed:[/] {e}")
        return 1


def cmd_report(args: argparse.Namespace) -> int:
    run_dir = Path(args.dir)
    if not run_dir.is_dir():
        console.print(f"[red]Not a directory:[/] {run_dir}")
        return 1
    summary_path = run_dir / "summary.json"
    if not summary_path.exists():
        console.print(f"[red]No summary.json in[/] {run_dir}")
        return 1
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    t = Table(show_header=False, box=None)
    t.add_column(style="cyan", width=18)
    t.add_column(style="white")
    for k, v in summary.items():
        t.add_row(k, json.dumps(v) if isinstance(v, (dict, list)) else str(v))
    console.print(Panel(t, title="Run report", border_style="blue"))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="meridian", description="Meridian Terminal CLI")
    parser.add_argument("--root", default=None, help="Repo/package root")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_data = sub.add_parser("data", help="Fetch OHLCV data")
    p_data.add_argument("fetch", nargs="?", default="fetch")
    p_data.add_argument("--symbol", default="^NDX")
    p_data.add_argument("--interval", default="15m")
    p_data.add_argument("--period", default="60d")
    p_data.add_argument("--refresh", action="store_true")
    p_data.add_argument("--out", type=str)

    p_sess = sub.add_parser("sessions", help="Session highs/lows")
    p_sess.add_argument("symbols", nargs="*")

    p_annot = sub.add_parser("annotate", help="Run annotation engine")
    p_annot.add_argument("--config", required=True)
    p_annot.add_argument("--out", type=str)
    p_annot.add_argument("--root", type=str)

    p_sim = sub.add_parser("simulate", help="Run backtest from config")
    p_sim.add_argument("--config", required=True)
    p_sim.add_argument("--out", type=str)
    p_sim.add_argument("--root", type=str)

    p_rep = sub.add_parser("report", help="Show report from run dir")
    p_rep.add_argument("--dir", required=True)

    args = parser.parse_args()

    if args.cmd == "data":
        return cmd_data_fetch(args)
    if args.cmd == "sessions":
        return cmd_sessions(args)
    if args.cmd == "annotate":
        return cmd_annotate(args)
    if args.cmd == "simulate":
        return cmd_simulate(args)
    if args.cmd == "report":
        return cmd_report(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
