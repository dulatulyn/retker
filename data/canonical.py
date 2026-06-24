"""
Canonical event schema — наш мини-OCSF.

Любой источник (транзакции, сетевые потоки, URL, активность юзера) нормализуется
в ОДИН формат CanonicalEvent. Это слой интеграции для продукта/демо/корреляции/UI.

ВАЖНАЯ идея (см. context/data-layer.md):
  - ЕДИНЫЙ ENVELOPE (этот файл) — для ingest, таймлайна, корреляции, дашборда, реплея.
  - PER-CLASS FEATURES (features.py) — для ML. Признаки сетевого потока != признаки
    транзакции, их НЕЛЬЗЯ сливать в одну модель. Канон унифицирует событие, а не фичи.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

# Якорь времени: датасеты с относительным временем (PaySim step=час, CC Time=сек,
# NSL-KDD без времени) разворачиваем в реальный таймлайн от этой точки — чтобы всё
# легло на одну ось и проигрывалось в реплее.
BASE_EPOCH = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc)


def synth_ts(*, seconds: float = 0.0, hours: float = 0.0) -> datetime:
    """Синтез ISO-времени из относительного смещения датасета."""
    return BASE_EPOCH + timedelta(seconds=seconds, hours=hours)


class EventClass(str, Enum):
    transaction = "transaction"      # CreditCardFraud, PaySim
    network_flow = "network_flow"    # CIC-IDS2017, NSL-KDD
    web = "web"                      # phishing URL/website
    user_activity = "user_activity"  # CERT insider (logon/file/http/email)
    authentication = "authentication"
    email = "email"


class ThreatCategory(str, Enum):
    """Единая таксономия меток поверх 4 угроз трека AI Shield."""
    benign = "benign"
    # несанкц. доступ / вторжения
    intrusion = "intrusion"
    brute_force = "brute_force"
    dos = "dos"
    port_scan = "port_scan"
    botnet = "botnet"
    web_attack = "web_attack"
    infiltration = "infiltration"
    # утечки / финансы
    fraud = "fraud"
    data_leak = "data_leak"
    # поведение
    insider = "insider"
    anomaly = "anomaly"
    # фишинг
    phishing = "phishing"
    unknown = "unknown"


class Label(BaseModel):
    """Ground-truth для обучения/оценки. Гармонизация разных меток источников."""
    is_malicious: bool = False
    category: ThreatCategory = ThreatCategory.benign
    original: Optional[str] = None  # исходная строка-метка из датасета


class Actor(BaseModel):
    user: Optional[str] = None
    account: Optional[str] = None
    ip: Optional[str] = None
    device: Optional[str] = None
    country: Optional[str] = None


class Target(BaseModel):
    account: Optional[str] = None
    host: Optional[str] = None
    ip: Optional[str] = None
    port: Optional[int] = None
    url: Optional[str] = None
    resource: Optional[str] = None


class Provenance(BaseModel):
    dataset: str
    source_row: Optional[int] = None


class CanonicalEvent(BaseModel):
    event_id: str
    ts: datetime
    event_class: EventClass
    action: Optional[str] = None
    actor: Actor = Field(default_factory=Actor)
    target: Target = Field(default_factory=Target)
    metrics: dict[str, float] = Field(default_factory=dict)   # числовые признаки
    attributes: dict[str, Any] = Field(default_factory=dict)  # категориальные/прочие
    label: Label = Field(default_factory=Label)
    severity: Optional[int] = None                            # 1..5, если известно
    provenance: Provenance
    raw: dict[str, Any] = Field(default_factory=dict)         # исходная запись (трассировка)


if __name__ == "__main__":
    # Экспорт JSON Schema — это «контракт» формата для всей команды.
    import json
    print(json.dumps(CanonicalEvent.model_json_schema(), ensure_ascii=False, indent=2))
