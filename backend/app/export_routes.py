from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from . import brain
from .ai import report_export
from .security import get_current_org
from .store import Org, store

export_router = APIRouter(prefix="/v1", tags=["app"])

_MEDIA = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@export_router.get("/reports/{iid}/export")
def export_report(iid: str, fmt: str = Query("docx"), org: Org = Depends(get_current_org)):
    inc = store.get_incident(org.id, iid)
    if inc is None:
        raise HTTPException(404, "Инцидент не найден")
    rep = brain.report(inc)
    if fmt == "xlsx":
        data = report_export.to_xlsx_bytes(rep)
    else:
        fmt = "docx"
        data = report_export.to_docx_bytes(rep)
    if data is None:
        raise HTTPException(503, "Экспорт недоступен (нет python-docx/xlsxwriter)")
    return Response(
        content=data,
        media_type=_MEDIA[fmt],
        headers={"Content-Disposition": f'attachment; filename="{iid}.{fmt}"'},
    )
