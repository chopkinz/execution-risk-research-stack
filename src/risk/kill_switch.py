from __future__ import annotations

from dataclasses import dataclass


@dataclass
class KillSwitch:
    active: bool = False
    reason: str = ""

    def trigger(self, reason: str) -> None:
        self.active = True
        self.reason = reason
