from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from .ai import search as ai_search
from .security import get_current_org
from .store import Org

search_router = APIRouter(prefix="/v1", tags=["app"])


@search_router.get("/search")
def search_logs(
    q: str = Query("", description="Семантический поиск по логам организации"),
    limit: int = Query(20, ge=1, le=100),
    org: Org = Depends(get_current_org),
):
    return ai_search.search(org.id, q, limit)
