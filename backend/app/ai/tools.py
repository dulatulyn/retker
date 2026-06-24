from __future__ import annotations

from datetime import datetime

from ..store import store
from . import rag, scoring


def _hour(ts: str) -> int:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
    except Exception:
        return 12


def _ev(e) -> dict:
    return {
        "event_id": e.event_id,
        "ts": e.ts,
        "class": e.event_class,
        "action": e.action,
        "actor": e.actor.user or e.actor.account,
        "ip": e.actor.ip,
        "country": e.actor.country,
        "severity": e.risk.severity,
        "score": round(e.risk.score, 3),
        "detectors": e.risk.detectors,
    }


def get_stats(org_id: str, args: dict) -> dict:
    events = store.events[org_id]
    alerts = store.alerts[org_id]
    incidents = store.list_incidents(org_id)
    by_cat: dict[str, int] = {}
    for a in alerts:
        by_cat[a.category] = by_cat.get(a.category, 0) + 1
    open_inc = sum(1 for i in incidents if i.status in ("open", "investigating"))
    return {
        "events": len(events),
        "alerts": len(alerts),
        "incidents": len(incidents),
        "open_incidents": open_inc,
        "alerts_by_category": by_cat,
    }


def search_logs(org_id: str, args: dict) -> dict:
    events = store.events[org_id]
    eid = (args.get("event_id") or "").strip() or None
    cls = (args.get("event_class") or "").strip().lower() or None
    country = (args.get("country") or "").strip().upper() or None
    user = (args.get("user") or "").strip().lower() or None
    action = (args.get("action") or "").strip().lower() or None
    night = bool(args.get("night"))
    min_sev = int(args.get("min_severity") or 0)
    limit = min(int(args.get("limit") or 20), 100)

    def ok(e) -> bool:
        if eid and e.event_id != eid:
            return False
        if cls and e.event_class != cls:
            return False
        if country and (e.actor.country or "").upper() != country:
            return False
        if user and user not in (e.actor.user or e.actor.account or "").lower():
            return False
        if action and (e.action or "").lower() != action:
            return False
        if night and not (0 <= _hour(e.ts) <= 5):
            return False
        if min_sev and e.risk.severity < min_sev:
            return False
        return True

    hits = [e for e in events if ok(e)]
    return {"count": len(hits), "events": [_ev(e) for e in hits[-limit:]]}


def list_incidents(org_id: str, args: dict) -> dict:
    status = (args.get("status") or "").strip().lower() or None
    limit = min(int(args.get("limit") or 20), 100)
    incs = store.list_incidents(org_id)
    if status:
        incs = [i for i in incs if i.status == status]
    return {
        "count": len(incs),
        "incidents": [
            {"id": i.id, "title": i.title, "category": i.category, "severity": i.severity,
             "score": round(i.score, 3), "status": i.status, "entity": i.entity}
            for i in incs[:limit]
        ],
    }


def get_incident(org_id: str, args: dict) -> dict:
    inc = store.get_incident(org_id, (args.get("incident_id") or "").strip())
    if inc is None:
        return {"error": "инцидент не найден"}
    return {
        "id": inc.id, "title": inc.title, "category": inc.category, "severity": inc.severity,
        "score": round(inc.score, 3), "status": inc.status, "entity": inc.entity,
        "hypothesis": inc.hypothesis, "ai_summary": inc.ai_summary,
        "timeline": inc.timeline, "recommended_actions": inc.recommended_actions,
        "mitre": inc.mitre,
    }


def get_alerts(org_id: str, args: dict) -> dict:
    category = (args.get("category") or "").strip().lower() or None
    limit = min(int(args.get("limit") or 20), 100)
    alerts = store.alerts[org_id]
    if category:
        alerts = [a for a in alerts if a.category == category]
    return {
        "count": len(alerts),
        "alerts": [
            {"id": a.id, "detector": a.detector, "category": a.category,
             "severity": a.severity, "title": a.title, "entity": a.entity}
            for a in alerts[-limit:]
        ],
    }


def search_knowledge(org_id: str, args: dict) -> dict:
    query = (args.get("query") or "").strip()
    docs = rag.search_playbooks(query, k=int(args.get("k") or 3))
    return {"results": [{"title": d["title"], "text": d["text"][:800]} for d in docs]}


def score_transaction(org_id: str, args: dict) -> dict:
    feats = args.get("features") or {}
    if not isinstance(feats, dict):
        return {"error": "features должен быть объектом признак→число"}
    res = scoring.score_features(args.get("model") or "fraud", feats)
    if res is None:
        return {"error": "модель недоступна или признаки несовместимы"}
    return res


def score_event(org_id: str, args: dict) -> dict:
    eid = (args.get("event_id") or "").strip()
    event = next((e for e in store.events[org_id] if e.event_id == eid), None)
    if event is None:
        return {"error": "событие не найдено"}
    res = scoring.score_event(event, org_id)
    if res is None:
        return {"error": "нет подходящей модели для этого класса события (или модель не загружена)"}
    return res


TOOLS: dict[str, dict] = {
    "get_stats": {
        "description": "Сводка по организации: сколько событий, алертов, инцидентов и разбивка по категориям.",
        "params": {},
        "fn": get_stats,
    },
    "search_logs": {
        "description": "Поиск событий в логах с фильтрами.",
        "params": {
            "event_id": "точный идентификатор события (evt_...)",
            "event_class": "access | data_activity | transaction | email",
            "country": "код страны, напр. KR",
            "user": "подстрока имени актора",
            "action": "тип действия",
            "night": "true — только ночные события (00–05)",
            "min_severity": "минимальная критичность 1..5",
            "limit": "сколько вернуть (по умолч. 20)",
        },
        "fn": search_logs,
    },
    "list_incidents": {
        "description": "Список инцидентов организации.",
        "params": {"status": "open | investigating | blocked | closed", "limit": "сколько"},
        "fn": list_incidents,
    },
    "get_incident": {
        "description": "Детали инцидента по id (таймлайн, гипотеза, рекомендации).",
        "params": {"incident_id": "идентификатор инцидента"},
        "fn": get_incident,
    },
    "get_alerts": {
        "description": "Список алертов, опционально по категории (access|anomaly|leak|phishing|fraud).",
        "params": {"category": "категория алерта", "limit": "сколько"},
        "fn": get_alerts,
    },
    "search_knowledge": {
        "description": "Поиск в базе знаний (плейбуки угроз, типологии отмыва, регуляторика РК).",
        "params": {"query": "поисковый запрос", "k": "сколько документов"},
        "fn": search_knowledge,
    },
    "score_transaction": {
        "description": "Скоринг по набору признаков выбранной моделью (fraud|anomaly).",
        "params": {"model": "fraud|anomaly", "features": "объект признак→число"},
        "fn": score_transaction,
    },
    "score_event": {
        "description": "Скоринг события по event_id: извлекает признаки из лога и оценивает обученной моделью.",
        "params": {"event_id": "идентификатор события"},
        "fn": score_event,
    },
}


def run_tool(name: str, org_id: str, args: dict) -> dict:
    tool = TOOLS.get(name)
    if tool is None:
        return {"error": f"неизвестный инструмент: {name}"}
    try:
        return tool["fn"](org_id, args or {})
    except Exception as e:
        return {"error": f"ошибка инструмента {name}: {e}"}
