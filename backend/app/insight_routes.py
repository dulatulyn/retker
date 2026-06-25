from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .ai import insight
from .security import get_current_org
from .store import Org, store

insight_router = APIRouter(prefix="/v1", tags=["app"])


class InsightIn(BaseModel):
    force: bool = False


@insight_router.post("/incidents/{iid}/insight")
def incident_insight(iid: str, body: InsightIn = InsightIn(),  # noqa: B008
                     org: Org = Depends(get_current_org)) -> dict:
    inc = store.get_incident(org.id, iid)
    if inc is None:
        raise HTTPException(404, "Инцидент не найден")
    return insight.generate(org.id, inc, force=body.force)
