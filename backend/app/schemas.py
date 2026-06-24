from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class RegisterIn(BaseModel):
    username: str
    password: str
    org_name: str = "Моя организация"


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrgOut(BaseModel):
    id: str
    name: str
    api_key: str


class MeOut(BaseModel):
    id: str
    username: str
    org: OrgOut


class Actor(BaseModel):
    user: Optional[str] = None
    account: Optional[str] = None
    ip: Optional[str] = None
    country: Optional[str] = None
    device: Optional[str] = None


class Target(BaseModel):
    account: Optional[str] = None
    host: Optional[str] = None
    resource: Optional[str] = None
    url: Optional[str] = None
    port: Optional[int] = None


class Risk(BaseModel):
    score: float = 0.0
    severity: int = 1
    detectors: list[str] = Field(default_factory=list)


class CanonicalEvent(BaseModel):
    event_id: str
    org_id: str
    ts: str
    event_class: str
    action: Optional[str] = None
    actor: Actor = Field(default_factory=Actor)
    target: Target = Field(default_factory=Target)
    metrics: dict[str, float] = Field(default_factory=dict)
    attributes: dict[str, Any] = Field(default_factory=dict)
    risk: Risk = Field(default_factory=Risk)
    raw: dict[str, Any] = Field(default_factory=dict)
    source: Optional[str] = None


class Alert(BaseModel):
    id: str
    org_id: str
    ts: str
    event_id: str
    detector: str
    category: str
    severity: int
    title: str
    entity: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    explanation: str = ""


class Incident(BaseModel):
    id: str
    org_id: str
    title: str
    category: str
    severity: int
    entity: str
    score: float = 0.0
    status: str = "open"
    created_at: str
    updated_at: str
    alert_ids: list[str] = Field(default_factory=list)
    timeline: list[dict[str, str]] = Field(default_factory=list)
    hypothesis: str = ""
    mitre: list[str] = Field(default_factory=list)
    ai_summary: str = ""
    recommended_actions: list[str] = Field(default_factory=list)


class AccessIn(BaseModel):
    ts: Optional[str] = None
    user: str
    ip: Optional[str] = None
    country: Optional[str] = None
    device: Optional[str] = None
    success: bool = True


class DataIn(BaseModel):
    ts: Optional[str] = None
    user: str
    resource: Optional[str] = None
    action: str = "access"
    rows: Optional[int] = None
    bytes: Optional[int] = None
    content: Optional[str] = None


class TransactionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ts: Optional[str] = None
    src: str = Field(alias="from")
    dst: str = Field(alias="to")
    amount: float
    type: str = "transfer"


class EmailIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    ts: Optional[str] = None
    sender: str = Field(alias="from")
    to: Optional[str] = None
    subject: Optional[str] = None
    links: list[str] = Field(default_factory=list)
    body: Optional[str] = None


class IngestOut(BaseModel):
    event_id: str
    risk: Risk
    incident_id: Optional[str] = None
    alerts: list[str] = Field(default_factory=list)


class QueryIn(BaseModel):
    q: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class BulkIn(BaseModel):
    ids: list[str] = Field(default_factory=list)
    action: str


class FromEventsIn(BaseModel):
    event_ids: list[str] = Field(default_factory=list)
    title: Optional[str] = None


class SourceCreate(BaseModel):
    name: str
    scope: str = "ingest"


class SourceOut(BaseModel):
    id: str
    name: str
    scope: str
    key: str
    created_at: str
    revoked: bool = False
    event_count: int = 0
    last_seen: Optional[str] = None
