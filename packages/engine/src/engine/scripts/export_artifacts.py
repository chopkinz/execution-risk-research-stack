from __future__ import annotations

import argparse
import shutil
from pathlib import Path

REQUIRED_FILES = [
    "summary.json",
    "equity_curve.png",
    "drawdown.png",
    "risk_rejections.png",
    "report.md",
]


def export_artifacts(source: Path, destination: Path) -> Path:
    if not source.exists():
        raise FileNotFoundError(f"Source artifacts not found: {source}")
    destination.mkdir(parents=True, exist_ok=True)

    for child in destination.iterdir():
        if child.is_file() or child.is_symlink():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)

    for child in source.iterdir():
        target = destination / child.name
        if child.is_file():
            shutil.copy2(child, target)
        elif child.is_dir():
            shutil.copytree(child, target)

    missing = [name for name in REQUIRED_FILES if not (destination / name).exists()]
    if missing:
        raise RuntimeError(f"Export incomplete, missing required artifacts: {missing}")
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Export engine artifacts into web public directory.")
    parser.add_argument("--source", type=Path, required=True, help="Source artifact directory.")
    parser.add_argument("--dest", type=Path, required=True, help="Destination artifact directory.")
    args = parser.parse_args()
    exported = export_artifacts(args.source, args.dest)
    print(f"exported_artifacts={exported}")


if __name__ == "__main__":
    main()
