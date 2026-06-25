from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from .schemas import Incident
from .store import nid

_rules: dict[str, list[dict[str, Any]]] = defaultdict(list)
_audit: dict[str, list[dict[str, Any]]] = defaultdict(list)

HTTP_TIMEOUT = 5.0
_AUDIT_MAX = 200


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_url_allowed(url: str) -> bool:
    return isinstance(url, str) and url.lower().startswith(("http://", "https://"))


def list_rules(org_id: str) -> list[dict[str, Any]]:
    return list(_rules[org_id])


def create_rule(org_id: str, data: dict[str, Any]) -> dict[str, Any]:
    trig = data.get("trigger") or {}
    act = data.get("action") or {}
    rule = {
        "id": nid("rule"),
        "org_id": org_id,
        "name": (data.get("name") or "").strip() or "Без названия",
        "enabled": bool(data.get("enabled", True)),
        "trigger": {
            "min_severity": int(trig.get("min_severity", 4)),
            "category": (trig.get("category") or None) or None,
            "detector": (trig.get("detector") or None) or None,
            "min_score": float(trig.get("min_score", 0.0)),
        },
        "action": {
            "method": (act.get("method") or "POST").upper(),
            "url": (act.get("url") or "").strip(),
            "headers": dict(act.get("headers") or {}),
            "body_template": act.get("body_template") or "",
            "body_mode": "ai" if (act.get("body_mode") == "ai") else "template",
        },
        "mode": "auto" if (data.get("mode") == "auto") else "manual",
        "created_at": _now(),
    }
    _rules[org_id].append(rule)
    try:
        from . import db
        db.save_rules(org_id, _rules[org_id])
    except Exception:
        pass
    return rule


def delete_rule(org_id: str, rid: str) -> bool:
    before = len(_rules[org_id])
    _rules[org_id] = [r for r in _rules[org_id] if r["id"] != rid]
    removed = len(_rules[org_id]) < before
    if removed:
        try:
            from . import db
            db.save_rules(org_id, _rules[org_id])
        except Exception:
            pass
    return removed


def get_rule(org_id: str, rid: str) -> Optional[dict[str, Any]]:
    return next((r for r in _rules[org_id] if r["id"] == rid), None)


def matches(rule: dict[str, Any], incident: Incident) -> bool:
    t = rule.get("trigger") or {}
    if incident.severity < int(t.get("min_severity", 0)):
        return False
    if incident.score < float(t.get("min_score", 0.0)):
        return False
    cat = t.get("category")
    if cat and incident.category != cat:
        return False
    det = t.get("detector")
    if det:
        hay = f"{incident.category} {incident.title}".lower()
        if det.lower() not in hay:
            return False
    return True


def render(body_template: str, incident: Incident) -> str:
    if not body_template:
        return ""
    actor_ip = ""
    for step in reversed(incident.timeline or []):
        ip = step.get("ip") if isinstance(step, dict) else None
        if ip:
            actor_ip = str(ip)
            break

    subs = {
        "{{incident.id}}": incident.id,
        "{{incident.title}}": incident.title,
        "{{entity}}": incident.entity,
        "{{severity}}": str(incident.severity),
        "{{score}}": str(incident.score),
        "{{category}}": incident.category,
        "{{actor.ip}}": actor_ip,
    }
    out = body_template
    for k, v in subs.items():
        out = out.replace(k, _esc_for_json(out, k, v))
    return out


def _esc_for_json(template: str, key: str, value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


AI_BODY_MAX_TOKENS = 600

AI_BODY_SYSTEM = (
    "Ты — модуль автоматического реагирования AI-SOC финансовой организации. "
    "По инциденту сформируй JSON-команду для внешней системы реагирования "
    "(антифрод-платформа, IRP/SOAR, банковский бэкенд). Верни ТОЛЬКО валидный JSON-объект, без пояснений. "
    "Состав полей адаптируй под тип угрозы: fraud — блокировка счёта и заморозка средств с суммой; "
    "leak — изоляция узла и отзыв доступа; phishing — заявка на снятие домена; "
    "access — сброс сессий и принудительный MFA; anomaly — постановка на усиленный мониторинг. "
    "Обязательно включи поля: action (краткий код действия), priority, incident_id, entity, severity, "
    "reason (на русском, одна строка), recommended_steps (массив строк)."
)


def _incident_brief(incident: Incident) -> dict[str, Any]:
    actor_ip = ""
    for step in reversed(incident.timeline or []):
        ip = step.get("ip") if isinstance(step, dict) else None
        if ip:
            actor_ip = str(ip)
            break
    return {
        "incident_id": incident.id,
        "title": incident.title,
        "category": incident.category,
        "severity": incident.severity,
        "score": incident.score,
        "entity": incident.entity,
        "actor_ip": actor_ip,
        "hypothesis": getattr(incident, "hypothesis", "") or "",
        "mitre": getattr(incident, "mitre", []) or [],
        "recommended_actions": getattr(incident, "recommended_actions", []) or [],
    }


def _deterministic_body(incident: Incident) -> str:
    b = _incident_brief(incident)
    sev = int(b["severity"])
    payload = {
        "action": "contain",
        "incident_id": b["incident_id"],
        "priority": "critical" if sev >= 5 else "high" if sev >= 4 else "normal",
        "severity": sev,
        "category": b["category"],
        "entity": b["entity"],
        "actor_ip": b["actor_ip"],
        "reason": b["title"],
        "recommended_steps": b["recommended_actions"],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def compose_body(rule: dict[str, Any], incident: Incident) -> str:
    act = rule.get("action") or {}
    mode = (act.get("body_mode") or "template").lower()
    template = act.get("body_template") or ""
    if mode != "ai":
        return render(template, incident)
    try:
        from .ai import insight
        data = insight.generate(incident.org_id, incident)
        if data and data.get("steps"):
            sev = int(incident.severity)
            payload = {
                "action": "respond",
                "priority": "critical" if sev >= 5 else "high" if sev >= 4 else "normal",
                "incident_id": incident.id,
                "entity": incident.entity,
                "severity": sev,
                "category": incident.category,
                "reason": data.get("summary") or incident.title,
                "steps": data.get("steps"),
                "ai_model": data.get("_model"),
                "rag_grounded": data.get("_grounded"),
                "confidence": data.get("confidence"),
            }
            return json.dumps(payload, ensure_ascii=False, indent=2)
    except Exception:
        pass
    try:
        from .ai.providers import router
        if router.available():
            user = "Инцидент:\n" + json.dumps(_incident_brief(incident), ensure_ascii=False, indent=2)
            instr = template.strip()
            if instr:
                user += "\n\nДоп. инструкция оператора:\n" + instr
            out = router.complete(
                AI_BODY_SYSTEM, [{"role": "user", "content": user}],
                json_mode=True, max_tokens=AI_BODY_MAX_TOKENS, temperature=0.2,
            )
            if out and out.strip():
                return out.strip()
    except Exception:
        pass
    return render(template, incident) if template.strip() else _deterministic_body(incident)


def fire(rule: dict[str, Any], incident: Incident, dry_run: bool = False) -> dict[str, Any]:
    act = rule.get("action") or {}
    method = (act.get("method") or "POST").upper()
    url = (act.get("url") or "").strip()
    headers = dict(act.get("headers") or {})
    body = compose_body(rule, incident)

    rec: dict[str, Any] = {
        "ts": _now(),
        "rule_id": rule.get("id"),
        "rule_name": rule.get("name"),
        "incident_id": incident.id,
        "method": method,
        "url": url,
        "status_code": None,
        "ok": False,
        "response_snippet": "",
        "request_body": body,
        "dry_run": dry_run,
    }

    if dry_run:
        rec["ok"] = True
        rec["response_snippet"] = "dry-run: запрос не отправлялся"
        return rec

    if not _is_url_allowed(url):
        rec["response_snippet"] = "URL запрещён политикой (allow-list)"
        return rec

    try:
        send_headers = {"Content-Type": "application/json", **headers}
        content = body.encode("utf-8") if body else None
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            resp = client.request(method, url, headers=send_headers, content=content)
        rec["status_code"] = resp.status_code
        rec["ok"] = 200 <= resp.status_code < 300
        rec["response_snippet"] = (resp.text or "")[:500]
    except Exception as exc:  # noqa: BLE001
        rec["response_snippet"] = f"Ошибка запроса: {type(exc).__name__}: {exc}"[:500]

    return rec


def _record_audit(org_id: str, rec: dict[str, Any]) -> None:
    lst = _audit[org_id]
    lst.append(rec)
    if len(lst) > _AUDIT_MAX:
        del lst[: len(lst) - _AUDIT_MAX]
    try:
        from . import db
        db.save_audit(org_id, lst)
    except Exception:
        pass


def load_from_db() -> None:
    try:
        from . import db
        for org_id, rules in db.load_rules().items():
            _rules[org_id] = rules
        for org_id, audit in db.load_audit().items():
            _audit[org_id] = audit
    except Exception:
        pass


def list_audit(org_id: str, limit: int = 100) -> list[dict[str, Any]]:
    return list(reversed(_audit[org_id][-limit:]))


def react(org_id: str, incident: Incident, *, only_enabled: bool = True,
          auto_only: bool = False, dry_run: bool = False) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for rule in _rules[org_id]:
        if only_enabled and not rule.get("enabled", True):
            continue
        if auto_only and rule.get("mode") != "auto":
            continue
        if not matches(rule, incident):
            continue
        rec = fire(rule, incident, dry_run=dry_run)
        if not dry_run:
            _record_audit(org_id, rec)
        out.append(rec)
    return out


def on_incident(org_id: str, incident: Incident) -> list[dict[str, Any]]:
    return react(org_id, incident, only_enabled=True, auto_only=True, dry_run=False)


def has_auto_rules(org_id: str) -> bool:
    return any(r.get("enabled", True) and r.get("mode") == "auto" for r in _rules[org_id])


def on_incident_bg(org_id: str, incident: Incident) -> None:
    if not has_auto_rules(org_id):
        return
    import threading
    threading.Thread(target=on_incident, args=(org_id, incident), daemon=True).start()


def sample_incident(org_id: str) -> Incident:
    now = _now()
    return Incident(
        id="inc_sample",
        org_id=org_id,
        title="Критическая утечка данных (пример)",
        category="leak",
        severity=5,
        entity="user@example.kz",
        score=0.92,
        status="open",
        created_at=now,
        updated_at=now,
        alert_ids=[],
        timeline=[{"ts": now, "label": "data_exfil", "ip": "203.0.113.7"}],
        hypothesis="Массовая выгрузка чувствительных данных на внешний адрес.",
        mitre=["T1567"],
        ai_summary="Пример инцидента для проверки правила реакции.",
        recommended_actions=["Заблокировать учётную запись", "Уведомить SOC"],
    )


def parse_headers(text: str) -> dict[str, str]:
    text = (text or "").strip()
    if not text:
        return {}
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return {str(k): str(v) for k, v in obj.items()}
    except Exception:
        pass
    out: dict[str, str] = {}
    for line in text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            k = k.strip()
            if k:
                out[k] = v.strip()
    return out
