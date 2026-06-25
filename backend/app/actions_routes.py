from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .bus import bus
from .schemas import Alert, Incident
from .security import get_current_org
from .store import Org, store

actions_router = APIRouter(prefix="/v1", tags=["actions"])

_journal: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
_assignee: dict[str, dict[str, str]] = defaultdict(dict)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_incident(org: Org, iid: str) -> Incident:
    inc = store.get_incident(org.id, iid)
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    return inc


def _log(org: Org, iid: str, kind: str, label: str, meta: Optional[dict] = None) -> dict:
    rec = {"ts": _now(), "kind": kind, "label": label, "meta": meta or {}}
    _journal[org.id][iid].append(rec)
    return rec


def _alerts_for(org: Org, inc: Incident) -> list[Alert]:
    return [a for a in store.alerts[org.id] if a.id in inc.alert_ids]


class CaseIn(BaseModel):
    assignee: Optional[str] = None


@actions_router.post("/incidents/{iid}/freeze")
def freeze_operation(iid: str, org: Org = Depends(get_current_org)):
    inc = _require_incident(org, iid)
    inc.timeline = list(inc.timeline) + [{"ts": _now(), "label": "Операция заморожена"}]
    inc.updated_at = _now()
    store.upsert_incident(inc)
    action = _log(org, iid, "freeze", "Операция заморожена")
    bus.publish(org.id, "incident", inc.model_dump())
    return {"ok": True, "action": action}


@actions_router.post("/incidents/{iid}/case")
def open_case(iid: str, body: CaseIn = CaseIn(), org: Org = Depends(get_current_org)):
    inc = _require_incident(org, iid)
    assignee = (body.assignee or "").strip()
    if assignee:
        _assignee[org.id][iid] = assignee
    inc.status = "investigating"
    inc.updated_at = _now()
    store.upsert_incident(inc)
    label = f"Создано дело, ответственный: {assignee}" if assignee else "Создано дело"
    _log(org, iid, "case", label, {"assignee": assignee})
    bus.publish(org.id, "incident", inc.model_dump())
    return inc.model_dump()


@actions_router.post("/incidents/{iid}/siem")
def send_to_siem(iid: str, org: Org = Depends(get_current_org)):
    inc = _require_incident(org, iid)
    ref = f"SIEM-{inc.id}"
    _log(org, iid, "siem", "Отправлено в SIEM", {"ref": ref})
    return {"ok": True, "ref": ref}


def _str_amount_type(inc: Incident, alerts: list[Alert]) -> tuple[Optional[float], Optional[str]]:
    for a in alerts:
        if a.category == "fraud" or a.detector == "fraud_rule":
            ev = a.evidence or {}
            return ev.get("amount"), ev.get("type")
    return None, None


def _str_indicators(alerts: list[Alert]) -> list[str]:
    out: list[str] = []
    for a in alerts:
        out.append(f"{a.detector} ({a.category}, критичность {a.severity}/5) — {a.title}")
    return out


def _str_typologies(inc: Incident, alerts: list[Alert]) -> list[str]:
    typ: list[str] = []
    cats = {a.category for a in alerts}
    if "fraud" in cats:
        typ.append("Вывод/обналичивание средств через промежуточные счета")
    if "leak" in cats:
        typ.append("Утечка персональных/платёжных данных")
    if "phishing" in cats:
        typ.append("Фишинг / социальная инженерия")
    if "access" in cats or "anomaly" in cats:
        typ.append("Несанкционированный доступ / захват аккаунта")
    typ += [m for m in inc.mitre]
    return typ


@actions_router.post("/incidents/{iid}/str")
def build_str(iid: str, org: Org = Depends(get_current_org)):
    inc = _require_incident(org, iid)
    alerts = _alerts_for(org, inc)
    amount, op_type = _str_amount_type(inc, alerts)
    now = _now()
    doc_no = f"СПО-{inc.id.replace('inc_', '').upper()}"

    lines: list[str] = [
        "# Сообщение о подозрительной операции (СПО)",
        "",
        f"**№ документа:** {doc_no}",
        f"**Дата формирования:** {now}",
        f"**Инцидент:** {inc.id} — {inc.title}",
        f"**Критичность:** {inc.severity}/5 · риск-скор {round(inc.score, 2)}",
        "",
        "## 1. Субъект / счёт",
        f"- Субъект (обезличено): {inc.entity}",
        f"- Категория инцидента: {inc.category}",
        "",
        "## 2. Тип операции и сумма",
        f"- Тип операции: {op_type or '—'}",
        f"- Сумма: {('%d ₸' % int(amount)) if isinstance(amount, (int, float)) else '—'}",
        "",
        "## 3. Основания подозрения",
        inc.ai_summary or "—",
    ]
    if inc.hypothesis:
        lines += ["", f"Гипотеза: {inc.hypothesis}"]
    typ = _str_typologies(inc, alerts)
    if typ:
        lines += ["", "Типологии:"]
        lines += [f"- {t}" for t in typ]

    lines += ["", "## 4. Сработавшие индикаторы"]
    inds = _str_indicators(alerts)
    lines += [f"- {x}" for x in inds] if inds else ["- Индикаторы не зафиксированы"]

    lines += ["", "## 5. Хронология"]
    if inc.timeline:
        lines += [f"- `{t.get('ts')}` — {t.get('label')}" for t in inc.timeline]
    else:
        lines += ["- —"]

    lines += ["", "## 6. Рекомендации"]
    lines += [f"- {r}" for r in inc.recommended_actions] if inc.recommended_actions else ["- —"]

    assignee = _assignee[org.id].get(iid)
    if assignee:
        lines += ["", f"**Ответственный по делу:** {assignee}"]

    lines += [
        "",
        "---",
        "_Правовое основание: Закон РК № 94-V «О противодействии легализации "
        "(отмыванию) доходов, полученных преступным путём, и финансированию терроризма». "
        "ИИН обезличены._",
    ]

    markdown = "\n".join(lines)
    filename = f"{doc_no}.md"
    _log(org, iid, "str", "Сформировано СПО", {"filename": filename})
    return {"markdown": markdown, "filename": filename}


@actions_router.get("/incidents/{iid}/actions")
def list_actions(iid: str, org: Org = Depends(get_current_org)):
    _require_incident(org, iid)
    return {
        "incident_id": iid,
        "assignee": _assignee[org.id].get(iid),
        "actions": list(_journal[org.id][iid]),
    }
