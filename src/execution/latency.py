from __future__ import annotations


class LatencyModel:
    def __init__(self, delay_bars: int = 0) -> None:
        self.delay_bars = max(0, delay_bars)

    def apply(self, bar_index: int) -> int:
        return bar_index + self.delay_bars
