"""
Session engine: Asia, London, New York sessions with timezone safety (America/Chicago default).

Computes session open/close, session high/low, range, midpoint; Asia/London/NY highs and lows;
previous day high/low; current day open. Outputs as annotations for chart overlays.
"""

from engine.sessions.engine import (
    SessionEngine,
    SessionConfig,
    SessionAnnotation,
    compute_sessions,
)

__all__ = [
    "SessionEngine",
    "SessionConfig",
    "SessionAnnotation",
    "compute_sessions",
]
