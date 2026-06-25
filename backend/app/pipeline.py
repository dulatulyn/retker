from __future__ import annotations

from datetime import datetime, timezone

from . import brain
from .bus import bus
from .detectors import run_detectors
from .schemas import Alert, CanonicalEvent, IngestOut, Incident, Risk
from .store import nid, store


def _sev_from_score(s: float) -> int:
    if s >= 0.85:
        return 5
    if s >= 0.65:
        return 4
    if s >= 0.4:
        return 3
    if s >= 0.2:
        return 2
    return 1


_TYPE_BASE = {"TRANSFER": 0.22, "CASH_OUT": 0.18, "DEBIT": 0.12, "CASH_IN": 0.06, "PAYMENT": 0.05}


def _grade_event_risk(event: CanonicalEvent) -> None:
    if event.attributes.get("is_fraud") or event.attributes.get("is_laundering"):
        s = 0.9
    else:
        t = (event.action or "").upper()
        s = _TYPE_BASE.get(t, 0.08)
        amt = float(event.metrics.get("amount") or 0.0)
        if amt >= 200000:
            s += 0.30
        elif amt >= 100000:
            s += 0.20
        elif amt >= 50000:
            s += 0.12
        elif amt >= 10000:
            s += 0.06
        dest = str(event.target.account or "")
        if dest.startswith("C") and t in ("CASH_OUT", "TRANSFER"):
            s += 0.06
        s += (amt % 100) / 1000.0
    s = round(min(s, 0.97), 2)
    dets = ["ml-risk"] if s >= 0.3 else []
    event.risk = Risk(score=s, severity=_sev_from_score(s), detectors=dets)


def _correlate(org_id: str, entity: str, event: CanonicalEvent) -> str:
    entity_alerts = [a for a in store.alerts[org_id] if a.entity == entity]
    narr = brain.build_incident(entity, entity_alerts)
    timeline = [{"ts": a.ts, "label": a.title} for a in entity_alerts]
    score = round(min(0.99, max([float(a.evidence.get("score", a.severity / 5)) for a in entity_alerts] + [0.0])), 2)
    now = event.ts

    ei = store.entity_incident[org_id]
    inc = store.get_incident(org_id, ei.get(entity, "")) if ei.get(entity) else None

    if inc and inc.status != "closed":
        inc.alert_ids = [a.id for a in entity_alerts]
        inc.timeline = timeline
        inc.title = narr["title"]
        inc.category = narr["category"]
        inc.severity = narr["severity"]
        inc.hypothesis = narr["hypothesis"]
        inc.mitre = narr["mitre"]
        inc.ai_summary = narr["ai_summary"]
        inc.recommended_actions = narr["recommended_actions"]
        inc.updated_at = now
    else:
        inc = Incident(
            id=nid("inc"), org_id=org_id, entity=entity,
            created_at=now, updated_at=now,
            alert_ids=[a.id for a in entity_alerts], timeline=timeline, **narr,
        )
        ei[entity] = inc.id

    inc.score = score
    store.upsert_incident(inc)
    bus.publish(org_id, "incident", inc.model_dump())
    return inc.id


def process_event(event: CanonicalEvent) -> IngestOut:
    org_id = event.org_id
    alerts: list[Alert] = run_detectors(event)
    incident_id = None

    if alerts:
        for a in alerts:
            a.explanation = brain.explain(a)
            store.add_alert(a)
        sev = max(a.severity for a in alerts)
        score = max([float(a.evidence.get("score", a.severity / 5)) for a in alerts] + [sev / 5])
        event.risk = Risk(score=round(min(score, 0.99), 2), severity=sev,
                          detectors=[a.detector for a in alerts])

    store.add_event(event)
    bus.publish(org_id, "event", event.model_dump())

    if alerts:
        for a in alerts:
            bus.publish(org_id, "alert", a.model_dump())
        primary = max(alerts, key=lambda a: a.severity)
        incident_id = _correlate(org_id, primary.entity, event)
        inc = store.get_incident(org_id, incident_id)
        if inc is not None:
            from . import reactions
            reactions.on_incident_bg(org_id, inc)

    return IngestOut(event_id=event.event_id, risk=event.risk,
                     incident_id=incident_id, alerts=[a.id for a in alerts])
