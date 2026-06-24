from __future__ import annotations

import json

from ..store import store
from ..schemas import Actor, Alert, CanonicalEvent, Risk, Target
from . import (
    chat,
    explain,
    health,
    nl_query,
    record_feedback,
    score_event,
    set_org_context,
)
from . import rag


def _seed() -> str:
    org = store.create_org("Selftest Bank")
    oid = org.id
    store.add_event(CanonicalEvent(
        event_id="evt_demo1", org_id=oid, ts="2026-06-24T02:47:00Z",
        event_class="access", action="login_success",
        actor=Actor(user="a.serik", ip="175.223.10.4", country="KR"),
        risk=Risk(score=0.92, severity=5, detectors=["impossible_travel"]),
    ))
    store.add_event(CanonicalEvent(
        event_id="evt_demo2", org_id=oid, ts="2026-06-24T02:14:00Z",
        event_class="data_activity", action="bulk_export",
        actor=Actor(user="a.serik", country="KZ"),
        metrics={"rows": 10480}, risk=Risk(score=0.88, severity=4, detectors=["ueba"]),
    ))
    store.add_event(CanonicalEvent(
        event_id="evt_demo3", org_id=oid, ts="2026-06-24T02:15:00Z",
        event_class="transaction", action="cash_out",
        actor=Actor(account="C1305486145"),
        metrics={"amount": 50000, "oldbalanceOrg": 50000, "newbalanceOrig": 0},
        risk=Risk(score=0.94, severity=4, detectors=["fraud_rule"]),
    ))
    store.add_alert(Alert(
        id="al_1", org_id=oid, ts="2026-06-24T02:47:00Z", event_id="evt_demo1",
        detector="impossible_travel", category="access", severity=5,
        title="Невозможная поездка (KZ→KR)", entity="a.serik",
        evidence={"from": "KZ", "to": "KR", "kmh": 5200},
    ))
    return oid


def main() -> None:
    print("=== health ===")
    print(json.dumps(health(), ensure_ascii=False, indent=2))

    oid = _seed()
    alert = store.alerts[oid][0]

    print("\n=== explain(alert) ===")
    print(explain(alert))

    print("\n=== nl_query ===")
    print(nl_query(oid, "покажи входы из новых стран ночью")["summary"])

    print("\n=== chat ===")
    print(chat(oid, "Сколько у нас инцидентов и какое событие самое опасное?")["reply"])

    print("\n=== score_event (транзакция) ===")
    tx = next(e for e in store.events[oid] if e.event_class == "transaction")
    print(json.dumps(score_event(tx, oid), ensure_ascii=False, indent=2))

    print("\n=== память организации (RAG по org_id) ===")
    set_org_context(oid, "Банк, окно обслуживания 09:00-19:00, выгрузки клиентской базы запрещены вне регламента.")
    record_feedback(oid, alert, "true_positive", "Подтверждён захват аккаунта.")
    ctx = rag.context_for(oid, "захват аккаунта выгрузка ночью")
    print(ctx[:600])


if __name__ == "__main__":
    main()
