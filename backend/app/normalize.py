from __future__ import annotations

from datetime import datetime, timezone

from .schemas import (
    AccessIn,
    Actor,
    CanonicalEvent,
    DataIn,
    EmailIn,
    Target,
    TransactionIn,
)
from .store import nid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def from_access(org_id: str, i: AccessIn) -> CanonicalEvent:
    return CanonicalEvent(
        event_id=nid("evt"),
        org_id=org_id,
        ts=i.ts or _now(),
        event_class="access",
        action="login_success" if i.success else "login_failed",
        actor=Actor(user=i.user, ip=i.ip, country=i.country, device=i.device),
        attributes={"success": i.success},
        raw=i.model_dump(),
    )


def from_data(org_id: str, i: DataIn) -> CanonicalEvent:
    metrics: dict[str, float] = {}
    if i.rows is not None:
        metrics["rows"] = float(i.rows)
    if i.bytes is not None:
        metrics["bytes"] = float(i.bytes)
    return CanonicalEvent(
        event_id=nid("evt"),
        org_id=org_id,
        ts=i.ts or _now(),
        event_class="data_activity",
        action=i.action,
        actor=Actor(user=i.user),
        target=Target(resource=i.resource),
        metrics=metrics,
        attributes={"content": i.content},
        raw=i.model_dump(),
    )


def from_transaction(org_id: str, i: TransactionIn) -> CanonicalEvent:
    return CanonicalEvent(
        event_id=nid("evt"),
        org_id=org_id,
        ts=i.ts or _now(),
        event_class="transaction",
        action=i.type,
        actor=Actor(account=i.src),
        target=Target(account=i.dst),
        metrics={"amount": float(i.amount)},
        raw=i.model_dump(by_alias=True),
    )


def from_email(org_id: str, i: EmailIn) -> CanonicalEvent:
    return CanonicalEvent(
        event_id=nid("evt"),
        org_id=org_id,
        ts=i.ts or _now(),
        event_class="email",
        action="email",
        actor=Actor(user=i.to),
        target=Target(url=i.links[0] if i.links else None),
        attributes={
            "sender": i.sender,
            "subject": i.subject,
            "links": i.links,
            "body": i.body,
        },
        raw=i.model_dump(by_alias=True),
    )
