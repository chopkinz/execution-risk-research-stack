from __future__ import annotations

import argparse
import copy
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.backtest.runner import default_run_dir, load_data_from_config, run_from_config
from src.core.config import load_config


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="configs/nas100_momentum.yaml")
    p.add_argument("--train-ratio", type=float, default=0.7)
    args = p.parse_args()

    cfg = load_config(ROOT / args.config)
    data = load_data_from_config(ROOT, cfg)
    if len(data) < 20:
        raise ValueError("Not enough bars for walkforward")

    cut = max(1, int(len(data) * args.train_ratio))
    train_df = data.iloc[:cut].copy().reset_index(drop=True)
    test_df = data.iloc[cut:].copy().reset_index(drop=True)
    if test_df.empty:
        raise ValueError("Train ratio produced empty test split")

    train_cfg = copy.deepcopy(cfg)
    test_cfg = copy.deepcopy(cfg)
    train_out = default_run_dir(ROOT, cfg, prefix="wf_train_")
    test_out = default_run_dir(ROOT, cfg, prefix="wf_test_")
    train_metrics, train_dir = run_from_config(ROOT, train_cfg, data=train_df, output_dir=train_out)
    test_metrics, test_dir = run_from_config(ROOT, test_cfg, data=test_df, output_dir=test_out)

    summary = pd.DataFrame(
        [
            {"segment": "train", **train_metrics, "run_dir": train_dir},
            {"segment": "test", **test_metrics, "run_dir": test_dir},
        ]
    )
    summary_path = ROOT / "outputs" / f"walkforward_summary_{Path(train_dir).name}.csv"
    summary.to_csv(summary_path, index=False)
    print(f"Walkforward summary: {summary_path}")
    print(summary.to_string(index=False))


if __name__ == "__main__":
    main()
