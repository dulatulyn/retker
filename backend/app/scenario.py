from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

from .normalize import from_access, from_data, from_email, from_transaction
from .pipeline import process_event
from .schemas import AccessIn, DataIn, EmailIn, TransactionIn


def _make_iin(p11: str) -> str:
    w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]
    c = sum(int(p11[i]) * w1[i] for i in range(11)) % 11
    if c == 10:
        c = sum(int(p11[i]) * w2[i] for i in range(11)) % 11
    if c == 10:
        return _make_iin(p11[:-1] + str((int(p11[-1]) + 1) % 10))
    return p11 + str(c)


IIN1 = _make_iin("90010135001")
IIN2 = _make_iin("88051450023")
LEAK_CONTENT = f"экспорт clients: ФИО, ИИН {IIN1}, {IIN2}; карта 4242 4242 4242 4242"


def _base() -> datetime:
    return datetime.now(timezone.utc).replace(hour=2, minute=0, second=0, microsecond=0)


def hero_steps() -> list[dict]:
    b = _base()

    def t(mins: int, secs: int = 0) -> str:
        return (b + timedelta(minutes=mins, seconds=secs)).isoformat()

    steps: list[dict] = [
        {"delay": 0.6, "kind": "access",
         "p": {"ts": t(0), "user": "u.berik", "ip": "10.2.4.51", "country": "KZ",
               "device": "PC-101", "success": True}},
    ]
    for s in range(5):
        steps.append({"delay": 0.35, "kind": "access",
                      "p": {"ts": t(11, s * 4), "user": "u.berik", "ip": "45.146.84.2",
                            "country": "RU", "success": False}})
    steps += [
        {"delay": 0.8, "kind": "access",
         "p": {"ts": t(13), "user": "u.berik", "ip": "175.223.10.4", "country": "KR",
               "device": "unknown", "success": True}},
        {"delay": 0.9, "kind": "data",
         "p": {"ts": t(14), "user": "u.berik", "resource": "db.clients", "action": "export",
               "rows": 10480, "bytes": 5242880, "content": LEAK_CONTENT}},
        {"delay": 0.7, "kind": "transaction",
         "p": {"ts": t(15), "from": "C1305486145", "to": "C553264065",
               "amount": 50000, "type": "transfer"}},
        {"delay": 0.7, "kind": "transaction",
         "p": {"ts": t(16), "from": "C1305486145", "to": "C553264065",
               "amount": 50000, "type": "cash_out"}},
        {"delay": 0.7, "kind": "email",
         "p": {"ts": t(17), "from": "no-reply@kaspi-bonus.xn--80a.tk", "to": "m.tulegen",
               "subject": "Ваш бонус 50 000 ₸", "links": ["http://kaspi-bonus.xn--80a.tk/login"]}},
    ]
    return steps


def _event_from(org_id: str, step: dict):
    k, p = step["kind"], step["p"]
    if k == "access":
        return from_access(org_id, AccessIn(**p))
    if k == "data":
        return from_data(org_id, DataIn(**p))
    if k == "transaction":
        return from_transaction(org_id, TransactionIn(**p))
    if k == "email":
        return from_email(org_id, EmailIn(**p))
    raise ValueError(k)


_HOUR_W = [1, 1, 1, 1, 1, 1, 2, 4, 7, 9, 9, 8, 7, 8, 9, 9, 8, 6, 4, 3, 2, 1, 1, 1]


def seed(org_id: str) -> None:
    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    today0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    users = ["a.satE", "d.suleimen", "m.tulegen", "n.abenov", "u.berik"]
    devices = {u: f"PC-{100 + i}" for i, u in enumerate(users)}

    def _ts(day_offset: int, cap_now: bool = False) -> str:
        base = today0 - timedelta(days=day_offset)
        hour = rng.choices(range(24), weights=_HOUR_W)[0]
        dt = base + timedelta(hours=hour, minutes=rng.randint(0, 59), seconds=rng.randint(0, 59))
        if cap_now and dt > now:
            dt = now - timedelta(minutes=rng.randint(1, 90))
        return dt.isoformat()

    def _benign(day: int) -> None:
        u = rng.choice(users)
        process_event(from_access(org_id, AccessIn(
            ts=_ts(day, cap_now=(day == 0)), user=u, ip="10.2.4." + str(rng.randint(2, 60)),
            country="KZ", device=devices[u], success=True)))

    # реалистичный фоновый поток за 30 дней (суточный паттерн «рабочие часы»)
    for day in range(30, -1, -1):
        for _ in range(rng.randint(10, 24)):
            _benign(day)

    # редкие исторические угрозы — чтобы на графике были цветные всплески по времени
    for day in (3, 7, 12, 18, 24, 28):
        base = today0 - timedelta(days=day)
        ts = (base + timedelta(hours=rng.randint(9, 18), minutes=rng.randint(0, 59))).isoformat()
        process_event(from_access(org_id, AccessIn(
            ts=ts, user=rng.choice(users), ip="45.146.84." + str(rng.randint(2, 250)),
            country=rng.choice(["RU", "DE", "TR"]), success=True)))

    # геройский сценарий — сегодня
    for step in hero_steps():
        process_event(_event_from(org_id, step))


async def replay(org_id: str) -> None:
    for step in hero_steps():
        process_event(_event_from(org_id, step))
        await asyncio.sleep(step["delay"])
