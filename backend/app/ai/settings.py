from __future__ import annotations

import os
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]
ML_DIR = _REPO_ROOT / "ml"
KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge"


def _load_dotenv() -> None:
    path = _BACKEND_DIR / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()


def _flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "1" if default else "0").lower() in ("1", "true", "yes", "on")


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")

PROVIDER_ORDER = [
    p.strip().lower()
    for p in os.environ.get("AI_PROVIDER_ORDER", "ollama,gemini,openai,anthropic").split(",")
    if p.strip()
]

OFFLINE = _flag("AI_OFFLINE", False)
HTTP_TIMEOUT = float(os.environ.get("AI_HTTP_TIMEOUT", "30"))
MAX_TOKENS = int(os.environ.get("AI_MAX_TOKENS", "1024"))
TEMPERATURE = float(os.environ.get("AI_TEMPERATURE", "0.3"))
AGENT_MAX_STEPS = int(os.environ.get("AI_AGENT_MAX_STEPS", "5"))
