from __future__ import annotations

import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import importer
from .store import store

test_router = APIRouter(prefix="/v1/test", tags=["test"])

_sink: deque[dict[str, Any]] = deque(maxlen=300)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rid() -> str:
    return uuid.uuid4().hex[:8]


async def _capture(request: Request, label: str = "") -> JSONResponse:
    raw = await request.body()
    body_text = raw.decode("utf-8", errors="replace")
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }
    rec = {
        "id": _rid(),
        "ts": _now(),
        "method": request.method,
        "label": label or "",
        "query": dict(request.query_params),
        "headers": headers,
        "content_type": request.headers.get("content-type", ""),
        "body": body_text[:4000],
        "size": len(raw),
    }
    _sink.append(rec)
    return JSONResponse(
        status_code=200,
        content={"ok": True, "id": rec["id"], "received_at": rec["ts"]},
    )


@test_router.get("/sink/log")
def sink_log(limit: int = 50) -> dict[str, Any]:
    return {"requests": list(reversed(_sink))[:limit]}


@test_router.delete("/sink/log")
def sink_clear() -> dict[str, Any]:
    n = len(_sink)
    _sink.clear()
    return {"ok": True, "cleared": n}


class ReplayIn(BaseModel):
    url: Optional[str] = None


@test_router.post("/sink/replay/{rid}")
def sink_replay(rid: str, body: Optional[ReplayIn] = None) -> dict[str, Any]:
    try:
        rec = next((r for r in _sink if r["id"] == rid), None)
        if rec is None:
            return {"ok": False, "error": "Запись не найдена"}
        url = body.url if body else None
        if url and url.startswith("http"):
            headers = {
                k: v for k, v in rec["headers"].items()
                if k.lower() not in ("host", "content-length")
            }
            with httpx.Client(timeout=5) as client:
                resp = client.request(
                    rec["method"], url,
                    content=rec["body"].encode("utf-8"),
                    headers=headers,
                )
            return {
                "ok": True,
                "status_code": resp.status_code,
                "response_snippet": resp.text[:500],
            }
        new = dict(rec)
        new["id"] = _rid()
        new["ts"] = _now()
        _sink.append(new)
        return {"ok": True, "replayed": True, "id": new["id"]}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


@test_router.api_route(
    "/sink", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
async def sink(request: Request) -> JSONResponse:
    return await _capture(request, "")


@test_router.api_route(
    "/sink/{label}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
async def sink_labeled(label: str, request: Request) -> JSONResponse:
    return await _capture(request, label)


class AttackIn(BaseModel):
    target: str
    rows: int = Field(default=1_000_000, ge=1, le=6_500_000)
    dataset: str = "paysim"


@test_router.post("/attack")
def attack(body: AttackIn) -> dict[str, Any]:
    org = store.org_by_key.get(body.target)
    if org is None:
        raise HTTPException(404, "Орг по ключу не найдена")
    path = importer.find_dataset(body.dataset)
    if not path:
        raise HTTPException(404, "Датасет не найден на сервере")
    return importer.run_import_file(
        org.id, path, preset=body.dataset, mapping=None,
        max_rows=body.rows, fast=True,
    )
