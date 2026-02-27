from __future__ import annotations

from pathlib import Path


def ensure_dirs(root: Path) -> dict[str, Path]:
    data_dir = root / "data_cache"
    out_dir = root / "outputs"
    for p in (data_dir, out_dir):
        p.mkdir(parents=True, exist_ok=True)
    return {"data": data_dir, "outputs": out_dir}
