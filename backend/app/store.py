from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from .schemas import Alert, CanonicalEvent, Incident


def nid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Org:
    id: str
    name: str
    api_key: str


@dataclass
class ApiKey:
    id: str
    org_id: str
    name: str
    scope: str
    key: str
    created_at: str
    revoked: bool = False
    event_count: int = 0
    last_seen: Optional[str] = None


@dataclass
class User:
    id: str
    username: str
    password_hash: str
    org_id: str


class Store:

    def __init__(self) -> None:
        self.orgs: dict[str, Org] = {}
        self.org_by_key: dict[str, Org] = {}
        self.users_by_id: dict[str, User] = {}
        self.users_by_name: dict[str, User] = {}

        self.api_keys: dict[str, ApiKey] = {}
        self.keys_by_org: dict[str, list[ApiKey]] = defaultdict(list)

        self.events: dict[str, list[CanonicalEvent]] = defaultdict(list)
        self.alerts: dict[str, list[Alert]] = defaultdict(list)
        self.incidents: dict[str, dict[str, Incident]] = defaultdict(dict)
        self.reports: dict[str, dict[str, dict]] = defaultdict(dict)

        self.det_state: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
        self.entity_incident: dict[str, dict[str, str]] = defaultdict(dict)

    def create_org(self, name: str) -> Org:
        org = Org(id=nid("org"), name=name, api_key=nid("key"))
        self.orgs[org.id] = org
        self.org_by_key[org.api_key] = org
        return org

    def create_user(self, username: str, password_hash: str, org_id: str) -> User:
        user = User(id=nid("usr"), username=username, password_hash=password_hash, org_id=org_id)
        self.users_by_id[user.id] = user
        self.users_by_name[username] = user
        return user

    def add_source(self, org_id: str, name: str, scope: str, key: str) -> ApiKey:
        ak = ApiKey(id=nid("src"), org_id=org_id, name=name, scope=scope, key=key, created_at=_now())
        self.api_keys[key] = ak
        self.keys_by_org[org_id].append(ak)
        return ak

    def create_source(self, org_id: str, name: str, scope: str) -> ApiKey:
        return self.add_source(org_id, name, scope, nid("key"))

    def list_sources(self, org_id: str) -> list[ApiKey]:
        return list(self.keys_by_org[org_id])

    def get_api_key(self, key: str) -> Optional[ApiKey]:
        return self.api_keys.get(key)

    def revoke_source(self, org_id: str, sid: str) -> bool:
        for ak in self.keys_by_org[org_id]:
            if ak.id == sid:
                ak.revoked = True
                return True
        return False

    def touch_api_key(self, ak: ApiKey) -> None:
        ak.event_count += 1
        ak.last_seen = _now()

    def add_event(self, e: CanonicalEvent) -> None:
        self.events[e.org_id].append(e)

    def add_alert(self, a: Alert) -> None:
        self.alerts[a.org_id].append(a)

    def upsert_incident(self, inc: Incident) -> None:
        self.incidents[inc.org_id][inc.id] = inc

    def get_incident(self, org_id: str, incident_id: str) -> Incident | None:
        return self.incidents[org_id].get(incident_id)

    def list_incidents(self, org_id: str) -> list[Incident]:
        return sorted(self.incidents[org_id].values(), key=lambda i: i.created_at, reverse=True)


store = Store()
