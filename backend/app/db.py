from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from .schemas import Alert, CanonicalEvent, Incident

log = logging.getLogger("retker.db")

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_URL = "sqlite:///" + str(_BACKEND_DIR / "retker.db")

DATABASE_URL = os.environ.get("DATABASE_URL", _DEFAULT_URL)

_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


class OrgRow(Base):
    __tablename__ = "orgs"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    api_key = Column(String, nullable=True)


class UserRow(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    org_id = Column(String, nullable=False)


class ApiKeyRow(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    scope = Column(String, nullable=False)
    key = Column(String, nullable=False)
    created_at = Column(String, nullable=True)
    revoked = Column(Boolean, default=False, nullable=False)
    event_count = Column(Integer, default=0, nullable=False)
    last_seen = Column(String, nullable=True)


class IncidentRow(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=False)
    data = Column(Text, nullable=False)


class AlertRow(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=False)
    data = Column(Text, nullable=False)


class EventTailRow(Base):
    __tablename__ = "event_tails"

    org_id = Column(String, primary_key=True)
    data = Column(Text, nullable=False)


class CounterRow(Base):
    __tablename__ = "counters"

    org_id = Column(String, primary_key=True)
    total_events = Column(Integer, default=0, nullable=False)


class RuleRow(Base):
    __tablename__ = "rules"

    id = Column(String, primary_key=True)
    org_id = Column(String, nullable=False)
    data = Column(Text, nullable=False)


class AuditRow(Base):
    __tablename__ = "audits"

    org_id = Column(String, primary_key=True)
    data = Column(Text, nullable=False)


_EVENT_TAIL_MAX = 500


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        log.warning("init_db failed: %s", exc)


def save_org(org) -> None:
    try:
        with SessionLocal() as s:
            s.merge(OrgRow(id=org.id, name=org.name, api_key=org.api_key))
            s.commit()
    except Exception as exc:
        log.warning("save_org failed: %s", exc)


def save_user(user) -> None:
    try:
        with SessionLocal() as s:
            s.merge(
                UserRow(
                    id=user.id,
                    username=user.username,
                    password_hash=user.password_hash,
                    org_id=user.org_id,
                )
            )
            s.commit()
    except Exception as exc:
        log.warning("save_user failed: %s", exc)


def save_api_key(ak) -> None:
    try:
        with SessionLocal() as s:
            s.merge(
                ApiKeyRow(
                    id=ak.id,
                    org_id=ak.org_id,
                    name=ak.name,
                    scope=ak.scope,
                    key=ak.key,
                    created_at=ak.created_at,
                    revoked=ak.revoked,
                    event_count=ak.event_count,
                    last_seen=ak.last_seen,
                )
            )
            s.commit()
    except Exception as exc:
        log.warning("save_api_key failed: %s", exc)


def save_incident(inc) -> None:
    try:
        with SessionLocal() as s:
            s.merge(
                IncidentRow(id=inc.id, org_id=inc.org_id, data=inc.model_dump_json())
            )
            s.commit()
    except Exception as exc:
        log.warning("save_incident failed: %s", exc)


def save_alert(a) -> None:
    try:
        with SessionLocal() as s:
            s.merge(AlertRow(id=a.id, org_id=a.org_id, data=a.model_dump_json()))
            s.commit()
    except Exception as exc:
        log.warning("save_alert failed: %s", exc)


def has_orgs() -> bool:
    try:
        with SessionLocal() as s:
            return s.query(OrgRow).first() is not None
    except Exception as exc:
        log.warning("has_orgs failed: %s", exc)
        return False


def load_all(store) -> None:
    from .store import ApiKey, Org, User

    try:
        with SessionLocal() as s:
            orgs = s.query(OrgRow).all()
            for row in orgs:
                org = Org(id=row.id, name=row.name, api_key=row.api_key)
                store.orgs[org.id] = org
                if org.api_key:
                    store.org_by_key[org.api_key] = org

            for row in s.query(UserRow).all():
                user = User(
                    id=row.id,
                    username=row.username,
                    password_hash=row.password_hash,
                    org_id=row.org_id,
                )
                store.users_by_id[user.id] = user
                store.users_by_name[user.username] = user

            for row in s.query(ApiKeyRow).all():
                ak = ApiKey(
                    id=row.id,
                    org_id=row.org_id,
                    name=row.name,
                    scope=row.scope,
                    key=row.key,
                    created_at=row.created_at,
                    revoked=bool(row.revoked),
                    event_count=row.event_count or 0,
                    last_seen=row.last_seen,
                )
                store.api_keys[ak.key] = ak
                store.keys_by_org[ak.org_id].append(ak)
                org = store.orgs.get(ak.org_id)
                if org and ak.key:
                    store.org_by_key[ak.key] = org

            for row in s.query(IncidentRow).all():
                inc = Incident.model_validate_json(row.data)
                store.incidents[inc.org_id][inc.id] = inc
                store.entity_incident[inc.org_id][inc.entity] = inc.id

            for row in s.query(AlertRow).all():
                a = Alert.model_validate_json(row.data)
                store.alerts[a.org_id].append(a)
    except Exception as exc:
        log.warning("load_all failed: %s", exc)


def save_event_tail(org_id, events) -> None:
    try:
        tail = list(events)[-_EVENT_TAIL_MAX:]
        payload = json.dumps([e.model_dump_json() for e in tail])
        with SessionLocal() as s:
            s.merge(EventTailRow(org_id=org_id, data=payload))
            s.commit()
    except Exception as exc:
        log.warning("save_event_tail failed: %s", exc)


def load_event_tails(store) -> None:
    try:
        with SessionLocal() as s:
            for row in s.query(EventTailRow).all():
                try:
                    raw = json.loads(row.data)
                except Exception:
                    continue
                events = []
                for item in raw:
                    try:
                        events.append(CanonicalEvent.model_validate_json(item))
                    except Exception:
                        try:
                            events.append(CanonicalEvent.model_validate(json.loads(item)))
                        except Exception:
                            continue
                store.events[row.org_id] = events
    except Exception as exc:
        log.warning("load_event_tails failed: %s", exc)


def save_counter(org_id, n) -> None:
    try:
        with SessionLocal() as s:
            s.merge(CounterRow(org_id=org_id, total_events=int(n)))
            s.commit()
    except Exception as exc:
        log.warning("save_counter failed: %s", exc)


def load_counters(store) -> None:
    try:
        with SessionLocal() as s:
            for row in s.query(CounterRow).all():
                store.total_events[row.org_id] = int(row.total_events or 0)
    except Exception as exc:
        log.warning("load_counters failed: %s", exc)


def save_rules(org_id, rules) -> None:
    try:
        with SessionLocal() as s:
            s.query(RuleRow).filter(RuleRow.org_id == org_id).delete()
            for rule in rules:
                s.add(RuleRow(id=rule["id"], org_id=org_id, data=json.dumps(rule)))
            s.commit()
    except Exception as exc:
        log.warning("save_rules failed: %s", exc)


def load_rules() -> dict:
    out: dict[str, list[dict]] = {}
    try:
        with SessionLocal() as s:
            for row in s.query(RuleRow).all():
                try:
                    rule = json.loads(row.data)
                except Exception:
                    continue
                out.setdefault(row.org_id, []).append(rule)
    except Exception as exc:
        log.warning("load_rules failed: %s", exc)
    return out


def save_audit(org_id, audit) -> None:
    try:
        with SessionLocal() as s:
            s.merge(AuditRow(org_id=org_id, data=json.dumps(list(audit))))
            s.commit()
    except Exception as exc:
        log.warning("save_audit failed: %s", exc)


def load_audit() -> dict:
    out: dict[str, list[dict]] = {}
    try:
        with SessionLocal() as s:
            for row in s.query(AuditRow).all():
                try:
                    out[row.org_id] = json.loads(row.data)
                except Exception:
                    continue
    except Exception as exc:
        log.warning("load_audit failed: %s", exc)
    return out
