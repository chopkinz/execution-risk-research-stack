"""
Annotation and market-structure signals for chart overlays and strategy input.

- FVG: Fair Value Gap detection with lifecycle and scoring.
- Structure: swing highs/lows, HH/HL/LH/LL, break of structure, change of character.
"""

from engine.signals.fvg import FVGEngine, FVGConfig, detect_fvgs
from engine.signals.structure import StructureEngine, detect_structure

__all__ = [
    "FVGEngine",
    "FVGConfig",
    "detect_fvgs",
    "StructureEngine",
    "detect_structure",
]
