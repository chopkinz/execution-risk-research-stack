from __future__ import annotations

import numpy as np


def parametric_var(returns: np.ndarray, confidence: float = 0.95) -> float:
    if returns.size == 0:
        return 0.0
    mu = float(np.mean(returns))
    sigma = float(np.std(returns))
    z = 1.65 if confidence == 0.95 else 2.33
    return max(0.0, -(mu - z * sigma))
