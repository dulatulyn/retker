from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from . import settings


@lru_cache(maxsize=16)
def load_model(path_str: str):
    try:
        import joblib
    except Exception:
        return None
    p = Path(path_str)
    if not p.exists():
        return None
    try:
        return joblib.load(p)
    except Exception:
        return None


@lru_cache(maxsize=16)
def load_card(path_str: str) -> dict | None:
    p = Path(path_str)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def fraud_card() -> dict | None:
    return load_card(str(settings.ML_DIR / "fraud_metrics.json"))


def model_card() -> dict | None:
    return fraud_card()
