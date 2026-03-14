from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "demo_run"
DEST = ROOT / "ui" / "public" / "demo_run"


def sync() -> Path:
    if not SOURCE.exists():
        raise RuntimeError(f"Source demo artifacts not found: {SOURCE}")
    DEST.mkdir(parents=True, exist_ok=True)
    for child in DEST.iterdir():
        if child.is_file() or child.is_symlink():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)
    for child in SOURCE.iterdir():
        target = DEST / child.name
        if child.is_file():
            shutil.copy2(child, target)
        elif child.is_dir():
            shutil.copytree(child, target)
    return DEST


def main() -> None:
    dest = sync()
    print(f"synced_ui_artifacts={dest}")


if __name__ == "__main__":
    main()
