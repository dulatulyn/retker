from __future__ import annotations

import json

from . import settings
from .prompts import agent_system
from .providers import router
from .tools import run_tool


def _parse_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    try:
        return json.loads(t)
    except Exception:
        pass
    start, end = t.find("{"), t.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(t[start:end + 1])
        except Exception:
            return None
    return None


def run_agent(org_id: str, question: str, history: list | None = None,
              max_steps: int | None = None) -> dict:
    steps = max_steps or settings.AGENT_MAX_STEPS
    msgs: list[dict] = []
    for h in (history or [])[-6:]:
        role = getattr(h, "role", None) or (h.get("role") if isinstance(h, dict) else None)
        content = getattr(h, "content", None) or (h.get("content") if isinstance(h, dict) else None)
        if role in ("user", "assistant") and content:
            msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": question})

    trace: list[dict] = []
    system = agent_system()

    for _ in range(steps):
        raw = router.complete(system, msgs, json_mode=True)
        obj = _parse_json(raw)
        if obj is None:
            return {"reply": raw.strip(), "trace": trace}
        if "final" in obj:
            return {"reply": str(obj["final"]).strip(), "trace": trace}
        if "tool" in obj:
            name = str(obj["tool"])
            args = obj.get("args") or {}
            result = run_tool(name, org_id, args if isinstance(args, dict) else {})
            trace.append({"tool": name, "args": args})
            msgs.append({"role": "assistant", "content": json.dumps(obj, ensure_ascii=False)})
            msgs.append({"role": "user",
                         "content": f"НАБЛЮДЕНИЕ ({name}): " + json.dumps(result, ensure_ascii=False)})
            continue
        return {"reply": raw.strip(), "trace": trace}

    msgs.append({"role": "user",
                 "content": 'Достаточно данных. Дай финальный ответ строго как {"final": "..."}.'})
    raw = router.complete(system, msgs, json_mode=True)
    obj = _parse_json(raw) or {}
    return {"reply": str(obj.get("final", raw)).strip(), "trace": trace}
