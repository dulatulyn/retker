from __future__ import annotations

import json

from . import rag
from .providers import router
from ..store import store

_cache: dict[str, dict] = {}

INSIGHT_SYSTEM = (
    "Ты — старший аналитик финансовой разведки (АФМ РК) в AI-SOC. "
    "По конкретному инциденту составь ПЛАН РЕАГИРОВАНИЯ. "
    "Опирайся на приложенный плейбук (типологии и процедуры) и на РЕАЛЬНЫЕ данные инцидента: "
    "сущности, счета, суммы, время, сработавшие детекторы и их evidence. "
    "Каждый шаг ОБЯЗАН быть привязан к конкретному значению из инцидента "
    "(счёт, сумма, домен, пользователь, время) — никаких общих советов уровня «проверить контрагента» без ID. "
    "Верни ТОЛЬКО валидный JSON-объект вида: "
    '{"summary": "1-2 предложения по сути этого кейса с конкретикой", '
    '"steps": [{"action": "краткое действие", "target": "конкретная сущность/счёт/домен из инцидента", '
    '"owner": "system|analyst|compliance", "executable": true, "sla_minutes": 5, '
    '"rationale": "почему, со ссылкой на признак или типологию"}], "confidence": 0.0}. '
    "3-5 шагов. owner=system только для того, что система реально умеет: заморозка счёта, блок сессии, "
    "отзыв токена, формирование СПО. Остальное — analyst или compliance. Пиши по-русски."
)


def _alerts_for(org_id: str, incident) -> list:
    ids = set(incident.alert_ids or [])
    by_id = [a for a in store.alerts[org_id] if a.id in ids]
    if by_id:
        return by_id
    return [a for a in store.alerts[org_id] if a.entity == incident.entity][-8:]


def _brief(org_id: str, incident) -> dict:
    alerts = _alerts_for(org_id, incident)
    return {
        "id": incident.id,
        "title": incident.title,
        "category": incident.category,
        "severity": incident.severity,
        "score": incident.score,
        "entity": incident.entity,
        "hypothesis": incident.hypothesis or "",
        "mitre": incident.mitre or [],
        "timeline": (incident.timeline or [])[-8:],
        "alerts": [
            {"detector": a.detector, "title": a.title, "severity": a.severity,
             "entity": a.entity, "evidence": a.evidence}
            for a in alerts[:8]
        ],
    }


def _parse_json(raw: str) -> dict | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        pass
    i, j = raw.find("{"), raw.rfind("}")
    if i >= 0 and j > i:
        try:
            return json.loads(raw[i:j + 1])
        except Exception:
            return None
    return None


def _owner_for(action: str) -> str:
    a = action.lower()
    if any(k in a for k in ("спо", "комплаенс", "финмонитор", "афм")):
        return "compliance"
    if any(k in a for k in ("заморо", "блок", "отзыв", "сброс", "сесси", "токен")):
        return "system"
    return "analyst"


def _fallback(org_id: str, incident, grounded: bool) -> dict:
    alerts = _alerts_for(org_id, incident)
    amount = None
    counterparty = None
    for a in alerts:
        if a.evidence.get("amount") and amount is None:
            amount = a.evidence.get("amount")
        if a.evidence.get("to") and counterparty is None:
            counterparty = a.evidence.get("to")
    steps = []
    for act in (incident.recommended_actions or ["Проверить инцидент"]):
        owner = _owner_for(act)
        target = incident.entity
        if "контрагент" in act.lower() and counterparty:
            target = str(counterparty)
        steps.append({
            "action": act,
            "target": target,
            "owner": owner,
            "executable": owner == "system",
            "sla_minutes": 5 if incident.severity >= 5 else 30,
            "rationale": incident.hypothesis or incident.title,
        })
    summary = incident.ai_summary or incident.title
    if amount:
        summary += f" Сумма по сработавшим алертам: {int(float(amount))}."
    return {
        "summary": summary,
        "steps": steps,
        "confidence": round(min(0.5 + incident.severity * 0.08, 0.9), 2),
        "_model": "fallback",
        "_grounded": grounded,
    }


def generate(org_id: str, incident, *, force: bool = False) -> dict:
    key = f"{org_id}:{incident.id}"
    if not force and key in _cache:
        return _cache[key]

    query = f"{incident.category} {incident.title} {' '.join(incident.mitre or [])}"
    context = rag.context_for(org_id, query, k=2)
    grounded = bool(context.strip())

    try:
        if router.available():
            user = ""
            if context.strip():
                user += "КОНТЕКСТ (плейбуки и память организации):\n" + context + "\n\n"
            user += "ИНЦИДЕНТ:\n" + json.dumps(_brief(org_id, incident), ensure_ascii=False, indent=2, default=str)
            raw = router.complete(
                INSIGHT_SYSTEM, [{"role": "user", "content": user}],
                json_mode=True, max_tokens=900, temperature=0.2,
            )
            data = _parse_json(raw)
            if data and isinstance(data.get("steps"), list) and data["steps"]:
                for s in data["steps"]:
                    if not s.get("owner"):
                        s["owner"] = _owner_for(str(s.get("action", "")))
                    s["executable"] = s.get("owner") == "system"
                data["_model"] = router.last_provider or "llm"
                data["_grounded"] = grounded
                data.setdefault("confidence", 0.7)
                _cache[key] = data
                return data
    except Exception:
        pass

    data = _fallback(org_id, incident, grounded)
    _cache[key] = data
    return data
