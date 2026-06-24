from __future__ import annotations

import json
from datetime import datetime

from ..store import store
from . import model, rag, scoring
from .agent import _parse_json, run_agent
from .prompts import CORRELATE_SYSTEM, EXPLAIN_SYSTEM, TRIAGE_SYSTEM
from .providers import AllProvidersFailed, router

_NL_FILTER_SYSTEM = (
    "Преобразуй вопрос аналитика безопасности в JSON-фильтр по логам. Верни строго JSON:\n"
    '{"event_class": "access|data_activity|transaction|email|null", '
    '"country": "код страны или null", "user": "подстрока имени или null", '
    '"night": true|false, "min_severity": 0}'
)


def _hour(ts: str) -> int:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
    except Exception:
        return 12


def _suggest(org_id: str) -> list[str]:
    alerts = store.alerts[org_id]
    cats = {a.category for a in alerts}
    out: list[str] = ["Сколько у нас инцидентов?", "Какое событие самое опасное?"]
    if "leak" in cats:
        out.append("Что делать с утечками?")
    elif "fraud" in cats:
        out.append("Кто инициатор подозрительных операций?")
    elif "phishing" in cats:
        out.append("Какие домены фишинговые?")
    else:
        out.append("Покажи открытые инциденты")
    return out[:3]


def explain(alert) -> str:
    context = rag.context_for(getattr(alert, "org_id", ""), f"{alert.detector} {alert.title}")
    prompt = (
        f"Алерт: {alert.title}\nДетектор: {alert.detector}\nКатегория: {alert.category}\n"
        f"Критичность: {alert.severity}/5\nСущность: {alert.entity}\n"
        f"Доказательства: {json.dumps(alert.evidence, ensure_ascii=False)}\n\n"
        f"База знаний:\n{context}"
    )
    try:
        return router.complete(EXPLAIN_SYSTEM, [{"role": "user", "content": prompt}]).strip()
    except AllProvidersFailed:
        return _explain_fallback(alert)


def _explain_fallback(alert) -> str:
    ev = "; ".join(f"{k}: {v}" for k, v in (alert.evidence or {}).items())
    base = f"{alert.title}. Категория «{alert.category}», критичность {alert.severity}/5."
    return f"{base} Сработал детектор {alert.detector}." + (f" Признаки: {ev}." if ev else "")


def triage(alert) -> dict:
    context = rag.context_for(getattr(alert, "org_id", ""), f"{alert.detector} {alert.title}")
    prompt = (
        f"Алерт: {alert.title}\nДетектор: {alert.detector}\nКатегория: {alert.category}\n"
        f"Доказательства: {json.dumps(alert.evidence, ensure_ascii=False)}\n\nБаза знаний:\n{context}"
    )
    try:
        raw = router.complete(TRIAGE_SYSTEM, [{"role": "user", "content": prompt}], json_mode=True)
        obj = _parse_json(raw) or {}
    except AllProvidersFailed:
        obj = {}
    return {
        "severity": int(obj.get("severity", alert.severity)),
        "category": obj.get("category", alert.category),
        "is_true_positive": bool(obj.get("is_true_positive", True)),
        "explanation_ru": obj.get("explanation_ru") or _explain_fallback(alert),
        "recommended_actions": obj.get("recommended_actions") or ["Проверить событие"],
    }


def build_incident(entity: str, alerts: list) -> dict:
    sev = max((a.severity for a in alerts), default=1)
    cat = alerts[0].category if alerts else "access"
    context = rag.context_for(getattr(alerts[0], "org_id", "") if alerts else "",
                              " ".join(a.detector for a in alerts))
    payload = [
        {"detector": a.detector, "category": a.category, "severity": a.severity,
         "title": a.title, "evidence": a.evidence}
        for a in alerts
    ]
    prompt = (
        f"Сущность: {entity}\nАлерты: {json.dumps(payload, ensure_ascii=False)}\n\n"
        f"База знаний:\n{context}"
    )
    try:
        raw = router.complete(CORRELATE_SYSTEM, [{"role": "user", "content": prompt}], json_mode=True)
        obj = _parse_json(raw)
    except AllProvidersFailed:
        obj = None
    if not obj:
        return _correlate_fallback(entity, alerts)
    return {
        "title": obj.get("title") or (alerts[0].title if alerts else "Инцидент"),
        "category": obj.get("category", cat),
        "severity": int(obj.get("severity", sev)),
        "hypothesis": obj.get("hypothesis", ""),
        "ai_summary": obj.get("ai_summary", ""),
        "recommended_actions": obj.get("recommended_actions") or ["Проверить"],
        "mitre": obj.get("mitre") or [],
    }


def _correlate_fallback(entity: str, alerts: list) -> dict:
    sev = max((a.severity for a in alerts), default=1)
    cats = {a.category for a in alerts}
    cat = next(iter(cats), "access")
    return {
        "title": (alerts[0].title if alerts else "Инцидент"),
        "category": cat,
        "severity": sev,
        "hypothesis": "",
        "ai_summary": f"Связанные алерты по {entity} ({', '.join(sorted(cats))}).",
        "recommended_actions": ["Проверить инцидент", "Принять решение по реакции"],
        "mitre": [],
    }


def _apply_filter(org_id: str, f: dict) -> list:
    cls = (f.get("event_class") or "").strip().lower()
    if cls in ("null", "none"):
        cls = ""
    country = (f.get("country") or "").strip().upper()
    user = (f.get("user") or "").strip().lower()
    night = bool(f.get("night"))
    min_sev = int(f.get("min_severity") or 0)
    out = []
    for e in store.events[org_id]:
        if cls and e.event_class != cls:
            continue
        if country and country not in ("NULL", "NONE") and (e.actor.country or "").upper() != country:
            continue
        if user and user not in (e.actor.user or e.actor.account or "").lower():
            continue
        if night and not (0 <= _hour(e.ts) <= 5):
            continue
        if min_sev and e.risk.severity < min_sev:
            continue
        out.append(e)
    return out


def nl_query(org_id: str, q: str) -> dict:
    try:
        raw = router.complete(_NL_FILTER_SYSTEM, [{"role": "user", "content": q}], json_mode=True)
        f = _parse_json(raw) or {}
    except AllProvidersFailed:
        f = _keyword_filter(q)
    hits = _apply_filter(org_id, f)[-50:]
    summary = (f"Нашёл {len(hits)} событий по запросу «{q}»."
               if hits else f"По запросу «{q}» ничего не найдено.")
    return {"summary": summary, "count": len(hits), "events": [e.model_dump() for e in hits]}


def _keyword_filter(q: str) -> dict:
    ql = q.lower()
    f: dict = {}
    if "вход" in ql or "логин" in ql:
        f["event_class"] = "access"
    elif "выгруз" in ql or "скач" in ql or "баз" in ql:
        f["event_class"] = "data_activity"
    elif "транзак" in ql or "перевод" in ql or "обнал" in ql:
        f["event_class"] = "transaction"
    elif "фишинг" in ql or "письм" in ql:
        f["event_class"] = "email"
    if "ноч" in ql:
        f["night"] = True
    return f


def chat(org_id: str, message: str, history: list | None = None) -> dict:
    try:
        res = run_agent(org_id, message, history)
        reply = res.get("reply") or _chat_fallback(org_id, message)
    except AllProvidersFailed:
        reply = _chat_fallback(org_id, message)
    return {"reply": reply, "suggestions": _suggest(org_id)}


def _chat_fallback(org_id: str, message: str) -> str:
    events = store.events[org_id]
    alerts = store.alerts[org_id]
    incidents = store.list_incidents(org_id)
    open_inc = sum(1 for i in incidents if i.status in ("open", "investigating"))
    return (f"Сейчас в системе {len(incidents)} инцидентов ({open_inc} открытых), "
            f"{len(alerts)} алертов и {len(events)} событий. "
            f"Спросите про утечки, фишинг, фрод или конкретного пользователя.")


def report(inc) -> dict:
    alerts = [a for a in store.alerts[inc.org_id] if a.id in inc.alert_ids]
    lines = [
        f"# Отчёт об инциденте {inc.id}",
        f"**{inc.title}** · критичность {inc.severity}/5 · статус: {inc.status}",
        "", "## Резюме", inc.ai_summary, "", "## Хронология",
    ]
    for t in inc.timeline:
        lines.append(f"- `{t['ts']}` {t['label']}")
    lines += ["", "## Гипотеза", inc.hypothesis, "", "## Рекомендации"]
    lines += [f"- {r}" for r in inc.recommended_actions]
    if inc.mitre:
        lines += ["", "## MITRE ATT&CK", ", ".join(inc.mitre)]
    lines += ["", "---",
              "_Соответствие: Закон РК «О персональных данных и их защите» № 94-V. ИИН обезличены._"]
    return {
        "incident_id": inc.id,
        "title": inc.title,
        "markdown": "\n".join(lines),
        "sections": {
            "summary": inc.ai_summary,
            "timeline": inc.timeline,
            "hypothesis": inc.hypothesis,
            "recommended_actions": inc.recommended_actions,
            "mitre": inc.mitre,
            "alerts": [a.model_dump() for a in alerts],
        },
    }


def record_feedback(org_id: str, alert, verdict: str, note: str = "") -> None:
    rag.remember_feedback(org_id, alert, verdict, note)


def record_incident(org_id: str, incident) -> None:
    rag.remember_incident(org_id, incident)


def set_org_context(org_id: str, text: str) -> None:
    rag.set_org_context(org_id, text)


def score_event(event, org_id: str) -> dict | None:
    return scoring.score_event(event, org_id)


def health() -> dict:
    return {
        "providers": router.status(),
        "provider_order": [p.name for p in router.providers],
        "online": router.available(),
        "last_provider": router.last_provider,
        "scorers": scoring.status(),
        "model_card": model.fraud_card(),
        "rag": rag.stats(),
    }
