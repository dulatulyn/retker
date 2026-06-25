from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import importer
from .security import get_current_org
from .store import Org

import_router = APIRouter(prefix="/v1", tags=["import"])


class ImportIn(BaseModel):
    format: str = "csv"
    preset: Optional[str] = None
    mapping: dict[str, str] = Field(default_factory=dict)
    data: str = ""
    max_rows: int = Field(default=2_000_000, ge=1, le=5_000_000)


class PreviewIn(BaseModel):
    format: str = "csv"
    preset: Optional[str] = None
    data: str = ""


@import_router.get("/import/presets")
def import_presets(org: Org = Depends(get_current_org)) -> dict[str, Any]:
    return {
        "presets": importer.list_presets(),
        "target_fields": importer.TARGET_FIELDS,
    }


@import_router.post("/import/preview")
def import_preview(body: PreviewIn, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    if not body.data.strip():
        raise HTTPException(400, "Пустые данные для предпросмотра")
    try:
        return importer.preview(body.format, body.data, body.preset, n=10)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Не удалось разобрать данные: {e}")


class DatasetIn(BaseModel):
    dataset: str = "paysim"
    rows: int = Field(default=1_000_000, ge=1, le=6_500_000)


@import_router.get("/import/datasets")
def import_datasets(org: Org = Depends(get_current_org)) -> dict[str, Any]:
    items = [("paysim", "PaySim — мобильные платежи (реальный датасет, 6.3М)")]
    return {"datasets": [
        {"name": n, "label": lbl, "available": bool(importer.find_dataset(n))}
        for n, lbl in items
    ]}


@import_router.post("/import/dataset")
def import_dataset(body: DatasetIn, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    preset = "paysim" if body.dataset == "paysim" else None
    path = importer.find_dataset(body.dataset)
    if not path:
        raise HTTPException(404, f"Датасет '{body.dataset}' не найден на сервере")
    try:
        r = importer.run_import_file(org.id, path, preset=preset, max_rows=body.rows)
        r["dataset"] = body.dataset
        return r
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Ошибка загрузки датасета: {e}")


@import_router.post("/import")
def import_logs(body: ImportIn, org: Org = Depends(get_current_org)) -> dict[str, Any]:
    if not body.data.strip():
        raise HTTPException(400, "Пустые данные для импорта")
    try:
        return importer.run_import(
            org.id,
            body.format,
            body.data,
            preset=body.preset,
            mapping=body.mapping,
            max_rows=body.max_rows,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Ошибка импорта: {e}")
