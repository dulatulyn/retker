from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import reactions
from .security import get_current_org
from .store import Org, store

reactions_router = APIRouter(prefix="/v1", tags=["reactions"])


class TriggerIn(BaseModel):
    min_severity: int = 4
    category: Optional[str] = None
    detector: Optional[str] = None
    min_score: float = 0.0


class ActionIn(BaseModel):
    method: str = "POST"
    url: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    body_template: str = ""
    body_mode: str = "template"


class RuleIn(BaseModel):
    name: str = ""
    enabled: bool = True
    trigger: TriggerIn = Field(default_factory=TriggerIn)
    action: ActionIn = Field(default_factory=ActionIn)
    mode: str = "manual"


@reactions_router.get("/reactions")
def get_reactions(org: Org = Depends(get_current_org)) -> dict[str, Any]:
    return {"rules": reactions.list_rules(org.id)}


@reactions_router.post("/reactions")
def post_reaction(body: RuleIn, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    if not (body.action.url or "").strip():
        raise HTTPException(400, "Укажите URL вебхука в действии правила")
    rule = reactions.create_rule(org.id, body.model_dump())
    return rule


@reactions_router.delete("/reactions/{rid}")
def del_reaction(rid: str, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    if not reactions.delete_rule(org.id, rid):
        raise HTTPException(404, "Правило не найдено")
    return {"ok": True}


class TestIn(BaseModel):
    incident_id: Optional[str] = None
    send: bool = False


@reactions_router.post("/reactions/{rid}/test")
def test_reaction(rid: str, body: TestIn = TestIn(),  # noqa: B008
                  org: Org = Depends(get_current_org)) -> dict[str, Any]:
    rule = reactions.get_rule(org.id, rid)
    if rule is None:
        raise HTTPException(404, "Правило не найдено")

    if body.incident_id:
        inc = store.get_incident(org.id, body.incident_id)
        if inc is None:
            raise HTTPException(404, "Инцидент не найден")
    else:
        incs = store.list_incidents(org.id)
        inc = incs[0] if incs else reactions.sample_incident(org.id)

    rendered = reactions.fire(rule, inc, dry_run=True)
    result: dict[str, Any] = {
        "incident_id": inc.id,
        "matches": reactions.matches(rule, inc),
        "rendered": rendered,
    }
    if body.send:
        result["sent"] = reactions.fire(rule, inc, dry_run=False)
    return result


class ReactIn(BaseModel):
    dry_run: bool = False
    auto_only: bool = False


@reactions_router.post("/incidents/{iid}/react")
def react_incident(iid: str, body: ReactIn = ReactIn(),  # noqa: B008
                   org: Org = Depends(get_current_org)) -> dict[str, Any]:
    inc = store.get_incident(org.id, iid)
    if inc is None:
        raise HTTPException(404, "Инцидент не найден")
    records = reactions.react(
        org.id, inc, only_enabled=True, auto_only=body.auto_only, dry_run=body.dry_run,
    )
    return {"incident_id": iid, "fired": records, "count": len(records)}


@reactions_router.get("/reactions/audit")
def reactions_audit(limit: int = 100, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    return {"audit": reactions.list_audit(org.id, limit=limit)}
