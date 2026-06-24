from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from . import brain, scenario
from .ai import analyst as ai_analyst
from .ai.agent import run_agent as ai_run_agent
from .ai.providers import AllProvidersFailed as AIProvidersFailed, router as ai_router
from .bus import bus
from .normalize import from_access, from_data, from_email, from_transaction
from .pipeline import process_event
from .schemas import (
    AccessIn, BulkIn, ChatIn, DataIn, EmailIn, FromEventsIn, Incident, IngestOut,
    LoginIn, MeOut, OrgOut, QueryIn, RegisterIn, SourceCreate, TokenOut, TransactionIn,
)
from .security import (
    IngestCtx, create_token, get_current_org, get_ingest_ctx, get_org_for_stream,
    hash_password, verify_password,
)
from .store import Org, nid, store


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(ts: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


TS_CATEGORIES = ["access", "anomaly", "leak", "fraud", "phishing", "normal"]


def _event_category(e) -> str:
    if e.risk.severity <= 1:
        return "normal"
    cls = e.event_class
    if cls == "access":
        return "access"
    if cls == "data_activity":
        dets = " ".join(e.risk.detectors).lower()
        return "leak" if ("dlp" in dets or "leak" in dets) else "anomaly"
    if cls == "transaction":
        return "fraud"
    if cls == "email":
        return "phishing"
    return "normal"


auth = APIRouter(prefix="/v1/auth", tags=["auth"])


@auth.post("/register", response_model=TokenOut)
def register(body: RegisterIn):
    if body.username in store.users_by_name:
        raise HTTPException(409, "Пользователь уже существует")
    org = store.create_org(body.org_name)
    store.add_source(org.id, "Основной коннектор", "full", org.api_key)
    user = store.create_user(body.username, hash_password(body.password), org.id)
    return TokenOut(access_token=create_token(user.id, org.id))


@auth.post("/login", response_model=TokenOut)
def login(body: LoginIn):
    user = store.users_by_name.get(body.username)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    return TokenOut(access_token=create_token(user.id, user.org_id))


@auth.get("/me", response_model=MeOut)
def me(org: Org = Depends(get_current_org)):
    user = next((u for u in store.users_by_id.values() if u.org_id == org.id), None)
    return MeOut(id=user.id if user else "—", username=user.username if user else "—",
                 org=OrgOut(id=org.id, name=org.name, api_key=org.api_key))


events = APIRouter(prefix="/v1/events", tags=["ingest"])


@events.post("/access", response_model=IngestOut)
def ingest_access(body: AccessIn, ctx: IngestCtx = Depends(get_ingest_ctx)):
    ev = from_access(ctx.org.id, body); ev.source = ctx.source
    return process_event(ev)


@events.post("/transaction", response_model=IngestOut)
def ingest_transaction(body: TransactionIn, ctx: IngestCtx = Depends(get_ingest_ctx)):
    ev = from_transaction(ctx.org.id, body); ev.source = ctx.source
    return process_event(ev)


@events.post("/data", response_model=IngestOut)
def ingest_data(body: DataIn, ctx: IngestCtx = Depends(get_ingest_ctx)):
    ev = from_data(ctx.org.id, body); ev.source = ctx.source
    return process_event(ev)


@events.post("/email", response_model=IngestOut)
def ingest_email(body: EmailIn, ctx: IngestCtx = Depends(get_ingest_ctx)):
    ev = from_email(ctx.org.id, body); ev.source = ctx.source
    return process_event(ev)


api = APIRouter(prefix="/v1", tags=["app"])


@api.get("/overview")
def overview(org: Org = Depends(get_current_org)):
    evs = store.events[org.id]
    alerts = store.alerts[org.id]
    incs = store.list_incidents(org.id)
    open_inc = [i for i in incs if i.status in ("open", "investigating")]
    blocked = [i for i in incs if i.status == "blocked"]
    leaks = [a for a in alerts if a.category == "leak"]

    cat = Counter(a.category for a in alerts)
    total = sum(cat.values()) or 1
    breakdown = [{"category": c, "count": n, "pct": round(n * 100 / total)}
                 for c, n in cat.most_common()]

    hourly = [0] * 24
    for e in evs:
        try:
            hourly[datetime.fromisoformat(e.ts.replace("Z", "+00:00")).hour] += 1
        except Exception:
            pass

    return {
        "kpis": {"events_24h": len(evs), "open_incidents": len(open_inc),
                 "blocked": len(blocked), "leaks_prevented": len(leaks)},
        "breakdown": breakdown,
        "hourly": hourly,
        "recent_incidents": [i.model_dump() for i in incs[:6]],
    }


@api.get("/events")
def list_events(limit: int = 50, org: Org = Depends(get_current_org)):
    return [e.model_dump() for e in store.events[org.id][-limit:][::-1]]


@api.get("/alerts")
def list_alerts(limit: int = 50, org: Org = Depends(get_current_org)):
    return [a.model_dump() for a in store.alerts[org.id][-limit:][::-1]]


@api.get("/incidents")
def list_incidents(org: Org = Depends(get_current_org)):
    return [i.model_dump() for i in store.list_incidents(org.id)]


@api.get("/incidents/{iid}")
def get_incident(iid: str, org: Org = Depends(get_current_org)):
    inc = store.get_incident(org.id, iid)
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    alerts = [a.model_dump() for a in store.alerts[org.id] if a.id in inc.alert_ids]
    return {"incident": inc.model_dump(), "alerts": alerts}


@api.post("/incidents/{iid}/block")
def block_incident(iid: str, org: Org = Depends(get_current_org)):
    inc = store.get_incident(org.id, iid)
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    inc.status = "blocked"
    inc.updated_at = _now()
    store.upsert_incident(inc)
    bus.publish(org.id, "incident", inc.model_dump())
    return inc.model_dump()


@api.post("/incidents/{iid}/feedback")
def feedback(iid: str, verdict: str = "confirmed", org: Org = Depends(get_current_org)):
    inc = store.get_incident(org.id, iid)
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    inc.status = "closed" if verdict == "false_positive" else inc.status
    inc.updated_at = _now()
    store.upsert_incident(inc)
    return inc.model_dump()


@api.post("/query")
def query(body: QueryIn, org: Org = Depends(get_current_org)):
    return brain.nl_query(org.id, body.q)


@api.get("/reports/{iid}")
def report(iid: str, org: Org = Depends(get_current_org)):
    inc = store.get_incident(org.id, iid)
    if not inc:
        raise HTTPException(404, "Инцидент не найден")
    return brain.report(inc)


@api.post("/replay")
async def replay(org: Org = Depends(get_current_org)):
    await scenario.replay(org.id)
    return {"status": "ok", "message": "Сценарий атаки проигран"}


@api.get("/timeseries")
def timeseries(range_: str = Query("day", alias="range"), org: Org = Depends(get_current_org)):
    rng = range_ if range_ in ("hour", "day", "week", "month") else "day"
    now = datetime.now(timezone.utc)

    if rng == "hour":
        count, step, fmt = 12, timedelta(minutes=5), "%H:%M"
    elif rng == "day":
        count, step, fmt = 24, timedelta(hours=1), "%H:%M"
    elif rng == "week":
        count, step, fmt = 7, timedelta(days=1), "%d.%m"
    else:
        count, step, fmt = 30, timedelta(days=1), "%d.%m"

    if rng == "hour":
        anchor = now.replace(second=0, microsecond=0) - timedelta(minutes=now.minute % 5)
    elif rng == "day":
        anchor = now.replace(minute=0, second=0, microsecond=0)
    else:
        anchor = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = anchor - step * (count - 1)

    buckets = []
    for i in range(count):
        b_start = start + step * i
        buckets.append({
            "label": b_start.strftime(fmt),
            "ts": b_start.isoformat(),
            "by": {c: 0 for c in TS_CATEGORIES},
            "total": 0,
        })

    end = start + step * count
    for e in store.events[org.id]:
        dt = _parse_ts(e.ts)
        if dt is None or dt < start or dt >= end:
            continue
        idx = int((dt - start) / step)
        if 0 <= idx < count:
            cat = _event_category(e)
            buckets[idx]["by"][cat] += 1
            buckets[idx]["total"] += 1

    return {"range": rng, "categories": TS_CATEGORIES, "buckets": buckets}


@api.post("/chat")
def chat(body: ChatIn, org: Org = Depends(get_current_org)):
    history = [m.model_dump() for m in body.history]
    online = ai_router.available()
    trace: list[dict] = []
    reply = ""
    if online:
        try:
            res = ai_run_agent(org.id, body.message, history)
            reply = (res.get("reply") or "").strip()
            trace = res.get("trace") or []
        except AIProvidersFailed:
            online = False
    if not reply:
        reply = ai_analyst._chat_fallback(org.id, body.message)
    return {
        "reply": reply,
        "suggestions": ai_analyst._suggest(org.id),
        "trace": [{"tool": t.get("tool"), "args": t.get("args") or {}} for t in trace],
        "online": online,
        "provider": ai_router.last_provider,
    }


def _source_out(ak) -> dict:
    return {
        "id": ak.id, "name": ak.name, "scope": ak.scope, "key": ak.key,
        "created_at": ak.created_at, "revoked": ak.revoked,
        "event_count": ak.event_count, "last_seen": ak.last_seen,
    }


@api.get("/sources")
def list_sources(org: Org = Depends(get_current_org)):
    return {"sources": [_source_out(s) for s in store.list_sources(org.id)]}


@api.post("/sources")
def create_source(body: SourceCreate, org: Org = Depends(get_current_org)):
    if body.scope not in ("ingest", "read", "full"):
        raise HTTPException(400, "scope должен быть ingest | read | full")
    name = (body.name or "").strip() or "Источник"
    ak = store.create_source(org.id, name, body.scope)
    return _source_out(ak)


@api.delete("/sources/{sid}")
def delete_source(sid: str, org: Org = Depends(get_current_org)):
    if not store.revoke_source(org.id, sid):
        raise HTTPException(404, "Источник не найден")
    return {"ok": True}


@api.post("/incidents/bulk")
def incidents_bulk(body: BulkIn, org: Org = Depends(get_current_org)):
    if body.action not in ("block", "close"):
        raise HTTPException(400, "action должен быть block или close")
    new_status = "blocked" if body.action == "block" else "closed"
    updated = []
    for iid in body.ids:
        inc = store.get_incident(org.id, iid)
        if not inc:
            continue
        inc.status = new_status
        inc.updated_at = _now()
        store.upsert_incident(inc)
        bus.publish(org.id, "incident", inc.model_dump())
        updated.append(inc.model_dump())
    return {"updated": updated}


@api.post("/incidents/from_events")
def incidents_from_events(body: FromEventsIn, org: Org = Depends(get_current_org)):
    ids = set(body.event_ids)
    evs = [e for e in store.events[org.id] if e.event_id in ids]
    if not evs:
        raise HTTPException(404, "События не найдены")
    order = {eid: n for n, eid in enumerate(body.event_ids)}
    evs.sort(key=lambda e: order.get(e.event_id, 0))

    first = evs[0]
    entity = first.actor.user or first.actor.account or "—"
    severity = max(e.risk.severity for e in evs)
    score = max(e.risk.score for e in evs)
    timeline = [{"ts": e.ts, "label": e.action or e.event_class} for e in evs]

    inc = Incident(
        id=nid("inc"),
        org_id=org.id,
        title=body.title or f"Ручной инцидент ({entity})",
        category="manual",
        severity=severity,
        entity=entity,
        score=score,
        status="open",
        created_at=_now(),
        updated_at=_now(),
        alert_ids=[],
        timeline=timeline,
        hypothesis="",
        mitre=[],
        ai_summary=f"Инцидент создан вручную из {len(evs)} событий.",
        recommended_actions=[],
    )
    store.upsert_incident(inc)
    bus.publish(org.id, "incident", inc.model_dump())
    return inc.model_dump()


@api.get("/stream")
async def stream(org: Org = Depends(get_org_for_stream)):
    async def gen():
        q = bus.subscribe(org.id)
        try:
            yield {"event": "ready", "data": "{}"}
            while True:
                msg = await q.get()
                yield {"event": msg["type"],
                       "data": json.dumps(msg["data"], ensure_ascii=False, default=str)}
        finally:
            bus.unsubscribe(org.id, q)

    return EventSourceResponse(gen())


ROUTERS = [auth, events, api]
