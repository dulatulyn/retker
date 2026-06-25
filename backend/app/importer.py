from __future__ import annotations

import csv
import io
import json
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Iterator, Optional

from . import brain
from .pipeline import _correlate, _grade_event_risk, process_event
from .schemas import Actor, Alert, CanonicalEvent, Risk, Target
from .store import nid, store


def _force_incident(org_id: str, ev: CanonicalEvent) -> None:
    entity = ev.actor.account or ev.actor.user or ev.target.account or "—"
    sev = ev.risk.severity if (ev.risk.severity and ev.risk.severity > 1) else 4
    amount = ev.metrics.get("amount")
    typ = ev.attributes.get("typology")
    a = Alert(
        id=nid("alr"), org_id=org_id, ts=ev.ts, event_id=ev.event_id,
        detector="aml_pattern", category="fraud", severity=sev,
        title=f"Подозрительная операция: {ev.action or 'перевод'} ({entity})",
        entity=entity,
        evidence={"amount": amount, "type": ev.action, "typology": typ,
                  "score": round(min(0.99, sev / 5), 2)},
        explanation=(f"Операция «{ev.action}» на сумму {amount}"
                     + (f", типология: {typ}" if typ else "")
                     + " — помечена как подозрительная (разметка датасета)."),
    )
    store.add_alert(a)
    return _correlate(org_id, entity, ev)

RAW_TAIL = 200
BATCH_SIZE = 5000
REACT_CAP = 20

TARGET_FIELDS = [
    "ts",
    "event_class",
    "action",
    "actor.user",
    "actor.account",
    "actor.ip",
    "actor.country",
    "target.account",
    "target.resource",
    "metrics.amount",
    "metrics.rows",
    "risk.severity",
    "source",
]

SAML_D_MAPPING: dict[str, str] = {
    "ts": "Time",
    "actor.account": "Sender_account",
    "target.account": "Receiver_account",
    "metrics.amount": "Amount",
    "actor.country": "Sender_bank_location",
    "target.country": "Receiver_bank_location",
    "action": "Payment_type",
}

PRESETS: dict[str, dict[str, Any]] = {
    "saml-d": {
        "label": "SAML-D (AML транзакции)",
        "description": "Синтетический датасет отмывания денег: Sender/Receiver, "
        "Amount, валюта, локации банков, метка Is_laundering.",
        "event_class": "transaction",
        "mapping": SAML_D_MAPPING,
    },
    "paysim": {
        "label": "PaySim (мобильные платежи, фрод)",
        "description": "Реальный датасет мобильных денежных переводов (6.3М строк): "
        "type, amount, nameOrig/nameDest, метка isFraud.",
        "event_class": "transaction",
        "mapping": {
            "action": "type",
            "actor.account": "nameOrig",
            "target.account": "nameDest",
            "metrics.amount": "amount",
        },
    },
    "linux-auth": {
        "label": "Linux auth.log (SSH / sshd)",
        "description": "Сырые системные логи Linux (syslog / auth.log): SSH-входы, "
        "Failed/Accepted password, Invalid user. Парсинг по полям ts/host/process/"
        "user/ip/port/result → детектор брутфорса.",
        "event_class": "access",
        "mapping": {
            "ts": "ts",
            "actor.user": "user",
            "actor.ip": "ip",
            "source": "process",
        },
    },
    "generic": {
        "label": "Generic (универсальный)",
        "description": "Произвольные логи — задайте маппинг колонок на поля OCSF "
        "вручную.",
        "event_class": "event",
        "mapping": {},
    },
}

SYSLOG_FIELDS = ["ts", "host", "process", "pid", "user", "ip", "port", "result", "message"]

_ISO_TS = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)\s+(.*)$")
_BSD_TS = re.compile(r"^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(.*)$")
_PROC = re.compile(r"^(\S+?)(?:\[(\d+)\])?:\s*(.*)$")
_FROM_IP = re.compile(r"\bfrom\s+(\d{1,3}(?:\.\d{1,3}){3})(?:\s+port\s+(\d+))?")
_FROM_IP6 = re.compile(r"\bfrom\s+([0-9a-fA-F:]+:[0-9a-fA-F:]+)(?:\s+port\s+(\d+))?")
_INVALID_USER = re.compile(r"\bfor invalid user\s+(\S+)")
_FAILED_USER = re.compile(r"\bFailed password for\s+(\S+)")
_ACCEPTED_USER = re.compile(r"\bAccepted \w+ for\s+(\S+)")
_INVALID_BARE = re.compile(r"\bInvalid user\s+(\S+)")


def _norm_iso_ts(raw: str) -> str:
    raw = raw.strip()
    iso = _ISO_TS.match(raw)
    if iso:
        return iso.group(1).replace("Z", "+00:00")
    year = datetime.now(timezone.utc).year
    for fmt in ("%Y %b %d %H:%M:%S",):
        try:
            dt = datetime.strptime(f"{year} {raw}", fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return raw


def parse_syslog(text: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.rstrip("\n")
        if not line.strip():
            continue
        ts: Optional[str] = None
        rest = line
        iso = _ISO_TS.match(line)
        if iso:
            ts = iso.group(1).replace("Z", "+00:00")
            rest = iso.group(2)
        else:
            bsd = _BSD_TS.match(line)
            if bsd:
                ts = _norm_iso_ts(bsd.group(1))
                rest = bsd.group(2)

        if ts is None:
            out.append({"message": line.strip(), "result": "other"})
            continue

        host: Optional[str] = None
        process: Optional[str] = None
        pid: Optional[str] = None
        message = rest

        parts = rest.split(" ", 1)
        if len(parts) == 2 and not parts[0].endswith(":"):
            host = parts[0]
            tail = parts[1]
        else:
            tail = rest

        pm = _PROC.match(tail)
        if pm:
            process = pm.group(1)
            pid = pm.group(2)
            message = pm.group(3)
        else:
            message = tail

        result = "other"
        user: Optional[str] = None
        ip: Optional[str] = None
        port: Optional[str] = None

        low = message.lower()
        if message.startswith("Failed password") or "authentication failure" in low or "failed password" in low:
            result = "failed"
        if "Invalid user" in message or "invalid user" in low:
            result = "invalid"
        if message.startswith("Accepted") or "accepted password" in low or "accepted publickey" in low:
            result = "accepted"

        mu = _INVALID_USER.search(message)
        if mu:
            user = mu.group(1)
        else:
            mu = _FAILED_USER.search(message)
            if mu:
                user = mu.group(1)
            else:
                mu = _ACCEPTED_USER.search(message)
                if mu:
                    user = mu.group(1)
                else:
                    mu = _INVALID_BARE.search(message)
                    if mu:
                        user = mu.group(1)

        mip = _FROM_IP.search(message) or _FROM_IP6.search(message)
        if mip:
            ip = mip.group(1)
            port = mip.group(2)

        if user == "":
            user = None

        out.append({
            "ts": ts,
            "host": host,
            "process": process,
            "pid": pid,
            "user": user,
            "ip": ip,
            "port": port,
            "result": result,
            "message": message,
        })
    return out


def list_presets() -> list[dict[str, Any]]:
    out = []
    for key, p in PRESETS.items():
        out.append(
            {
                "key": key,
                "label": p["label"],
                "description": p["description"],
                "event_class": p["event_class"],
                "mapping": p["mapping"],
                "target_fields": TARGET_FIELDS,
            }
        )
    return out


def _parse_csv(data: str) -> tuple[list[str], Iterator[dict[str, Any]]]:
    buf = io.StringIO(data)
    sample = data[:4096]
    delimiter = ","
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except Exception:
        pass
    reader = csv.DictReader(buf, delimiter=delimiter)
    headers = list(reader.fieldnames or [])
    return headers, iter(reader)


def _parse_json(data: str) -> tuple[list[str], Iterator[dict[str, Any]]]:
    obj = json.loads(data)
    if isinstance(obj, dict):
        for k in ("events", "data", "rows", "items"):
            if isinstance(obj.get(k), list):
                obj = obj[k]
                break
        else:
            obj = [obj]
    if not isinstance(obj, list):
        raise ValueError("JSON должен быть списком объектов или {events:[...]}")
    headers: list[str] = []
    seen: set[str] = set()
    for row in obj[:200]:
        if isinstance(row, dict):
            for k in row.keys():
                if k not in seen:
                    seen.add(k)
                    headers.append(k)
    return headers, iter(r for r in obj if isinstance(r, dict))


def parse(fmt: str, data: str) -> tuple[list[str], Iterator[dict[str, Any]]]:
    fmt = (fmt or "").lower()
    if fmt == "csv":
        return _parse_csv(data)
    if fmt == "json":
        return _parse_json(data)
    if fmt == "syslog":
        rows = parse_syslog(data)
        return SYSLOG_FIELDS, iter(rows)
    raise ValueError(f"Неподдерживаемый формат: {fmt!r} (csv|json|syslog)")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get(row: dict[str, Any], col: Optional[str]) -> Any:
    if not col:
        return None
    if col in row:
        return row[col]
    lc = col.lower()
    for k, v in row.items():
        if isinstance(k, str) and k.lower() == lc:
            return v
    return None


def _to_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(",", "").replace(" ", ""))
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> Optional[int]:
    f = _to_float(v)
    return int(f) if f is not None else None


def _norm_ts(date_val: Any, time_val: Any) -> str:
    parts = [str(p).strip() for p in (date_val, time_val) if p not in (None, "")]
    if not parts:
        return _now()
    raw = " ".join(parts)
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.year == 1900:
                today = datetime.now(timezone.utc)
                dt = dt.replace(year=today.year, month=today.month, day=today.day)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return raw


def map_row(
    org_id: str,
    row: dict[str, Any],
    mapping: dict[str, str],
    *,
    default_event_class: str = "event",
    preset: Optional[str] = None,
) -> CanonicalEvent:
    ts = _norm_ts(_get(row, mapping.get("ts")), _get(row, mapping.get("Date") or "Date"))
    if "Date" in row or "Time" in row:
        ts = _norm_ts(row.get("Date"), row.get("Time")) if (row.get("Date") or row.get("Time")) else ts

    event_class = _get(row, mapping.get("event_class")) or default_event_class
    action = _get(row, mapping.get("action"))

    actor = Actor(
        user=_get(row, mapping.get("actor.user")),
        account=_get(row, mapping.get("actor.account")),
        ip=_get(row, mapping.get("actor.ip")),
        country=_get(row, mapping.get("actor.country")),
    )
    target = Target(
        account=_get(row, mapping.get("target.account")),
        resource=_get(row, mapping.get("target.resource")),
    )

    metrics: dict[str, float] = {}
    amt = _to_float(_get(row, mapping.get("metrics.amount")))
    if amt is not None:
        metrics["amount"] = amt
    rows_m = _to_float(_get(row, mapping.get("metrics.rows")))
    if rows_m is not None:
        metrics["rows"] = rows_m

    attributes: dict[str, Any] = {}
    severity = _to_int(_get(row, mapping.get("risk.severity")))

    if preset == "saml-d":
        typ = row.get("Laundering_type")
        is_laundering = row.get("Is_laundering")
        if typ:
            attributes["typology"] = typ
        if is_laundering not in (None, ""):
            attributes["is_laundering"] = _to_int(is_laundering)
        cur = row.get("Payment_currency") or row.get("Received_currency")
        if cur:
            attributes["currency"] = cur
        tgt_country = _get(row, mapping.get("target.country"))
        if tgt_country:
            attributes["receiver_country"] = tgt_country
        if severity is None and _to_int(is_laundering):
            severity = 4

    if preset == "paysim":
        if _to_int(row.get("isFraud")):
            attributes["is_fraud"] = 1
            if severity is None:
                severity = 5
        if _to_int(row.get("isFlaggedFraud")):
            attributes["flagged_by_bank"] = 1

    if preset == "linux-auth":
        raw_ts = _get(row, mapping.get("ts")) or row.get("ts")
        if raw_ts:
            ts = _norm_iso_ts(str(raw_ts))
        result = (row.get("result") or "other")
        attributes["success"] = result not in ("failed", "invalid")
        attributes["result"] = result
        if row.get("port") is not None:
            attributes["port"] = row.get("port")
        if row.get("host"):
            attributes["host"] = row.get("host")
        if row.get("message"):
            attributes["message"] = row.get("message")
        action = action or result

    risk = Risk(severity=severity if severity else 1)

    return CanonicalEvent(
        event_id=nid("evt"),
        org_id=org_id,
        ts=str(ts),
        event_class=str(event_class),
        action=str(action) if action else None,
        actor=actor,
        target=target,
        metrics=metrics,
        attributes=attributes,
        risk=risk,
        source=_get(row, mapping.get("source")) or (preset and PRESETS.get(preset, {}).get("label")) or "Импорт",
        raw=row,
    )


def _suggest_mapping(headers: list[str], preset: Optional[str]) -> dict[str, str]:
    if preset and preset in PRESETS and PRESETS[preset]["mapping"]:
        present = {h.lower(): h for h in headers}
        m = {}
        for tgt, col in PRESETS[preset]["mapping"].items():
            if col in headers:
                m[tgt] = col
            elif col.lower() in present:
                m[tgt] = present[col.lower()]
        return m

    present = {h.lower(): h for h in headers}
    hints: dict[str, list[str]] = {
        "ts": ["ts", "time", "timestamp", "date", "datetime", "@timestamp"],
        "event_class": ["event_class", "class", "category", "type"],
        "action": ["action", "event", "operation", "payment_type", "verb"],
        "actor.user": ["user", "username", "actor", "subject", "principal", "src_user"],
        "actor.account": ["sender_account", "from_account", "src_account", "account", "from"],
        "actor.ip": ["ip", "src_ip", "source_ip", "client_ip", "ip_address"],
        "actor.country": ["sender_bank_location", "src_country", "country", "geo"],
        "target.account": ["receiver_account", "to_account", "dst_account", "to"],
        "target.resource": ["resource", "object", "dst", "target", "url", "host"],
        "metrics.amount": ["amount", "value", "sum", "total"],
        "metrics.rows": ["rows", "count", "records", "row_count"],
        "risk.severity": ["severity", "sev", "risk", "level"],
        "source": ["source", "connector", "log_source", "device"],
    }
    out: dict[str, str] = {}
    for tgt, opts in hints.items():
        for o in opts:
            if o in present:
                out[tgt] = present[o]
                break
    return out


def preview(fmt: str, data: str, preset: Optional[str], n: int = 10) -> dict[str, Any]:
    headers, it = parse(fmt, data)
    sample = []
    for i, row in enumerate(it):
        if i >= n:
            break
        sample.append(row)
    suggested = _suggest_mapping(headers, preset)
    return {
        "headers": headers,
        "sample": sample,
        "suggested_mapping": suggested,
        "target_fields": TARGET_FIELDS,
        "preset": preset,
    }


def _batched(it: Iterable[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for row in it:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def run_import(
    org_id: str,
    fmt: str,
    data: str,
    *,
    preset: Optional[str] = None,
    mapping: Optional[dict[str, str]] = None,
    max_rows: int = 2_000_000,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    headers, it = parse(fmt, data)

    if mapping is None:
        mapping = {}
    if preset and preset in PRESETS:
        merged = dict(PRESETS[preset]["mapping"])
        merged.update(mapping)
        mapping = merged
    default_class = PRESETS.get(preset or "", {}).get("event_class", "event")

    ingested = 0
    alerts_before = len(store.alerts[org_id])
    inc_before = len(store.incidents[org_id])

    by_class: Counter[str] = Counter()
    by_day: Counter[str] = Counter()
    top_actors: Counter[str] = Counter()
    top_targets: Counter[str] = Counter()
    total_amount = 0.0
    flagged = 0
    touched: set[str] = set()

    fresh_events: list[CanonicalEvent] = []

    for batch in _batched(it, BATCH_SIZE):
        for raw_row in batch:
            if ingested >= max_rows:
                break
            try:
                ev = map_row(
                    org_id, raw_row, mapping,
                    default_event_class=default_class, preset=preset,
                )
            except Exception:
                continue

            out = process_event(ev)
            ingested += 1

            by_class[ev.event_class] += 1
            by_day[ev.ts[:10]] += 1
            if ev.event_class == "access":
                if ev.actor.ip:
                    top_actors[str(ev.actor.ip)] += 1
                if ev.actor.user:
                    top_targets[str(ev.actor.user)] += 1
            else:
                if ev.actor.account or ev.actor.user:
                    top_actors[str(ev.actor.account or ev.actor.user)] += 1
                if ev.target.account or ev.target.resource:
                    top_targets[str(ev.target.account or ev.target.resource)] += 1
            total_amount += ev.metrics.get("amount", 0.0)
            if out.alerts:
                flagged += 1
                if out.incident_id:
                    touched.add(out.incident_id)
            elif ev.attributes.get("is_fraud") or ev.attributes.get("is_laundering"):
                iid = _force_incident(org_id, ev)
                flagged += 1
                if iid:
                    touched.add(iid)

            fresh_events.append(ev)
        if len(fresh_events) > RAW_TAIL:
            fresh_events = fresh_events[-RAW_TAIL:]
        if len(store.events[org_id]) > RAW_TAIL:
            store.events[org_id] = store.events[org_id][-RAW_TAIL:]
        if ingested >= max_rows:
            break

    if len(store.events[org_id]) > RAW_TAIL:
        store.events[org_id] = store.events[org_id][-RAW_TAIL:]

    alerts_new = len(store.alerts[org_id]) - alerts_before
    inc_new = len(store.incidents[org_id]) - inc_before
    elapsed = max(time.perf_counter() - t0, 1e-6)

    return {
        "ingested": ingested,
        "alerts": max(alerts_new, 0),
        "incidents": max(inc_new, len(touched)),
        "flagged_events": flagged,
        "elapsed_sec": round(elapsed, 3),
        "throughput_eps": round(ingested / elapsed, 1),
        "preset": preset,
        "mapping": mapping,
        "aggregates": {
            "by_class": dict(by_class),
            "by_day": dict(sorted(by_day.items())),
            "top_actors": top_actors.most_common(10),
            "top_targets": top_targets.most_common(10),
            "total_amount": round(total_amount, 2),
        },
        "raw_retained": len(store.events[org_id]),
    }


FILE_BATCH_SIZE = 50000


def run_import_file(
    org_id: str,
    path: str,
    *,
    preset: Optional[str] = None,
    mapping: Optional[dict[str, str]] = None,
    max_rows: int = 2_000_000,
    fast: bool = False,
) -> dict[str, Any]:
    t0 = time.perf_counter()
    if mapping is None:
        mapping = {}
    if preset and preset in PRESETS:
        merged = dict(PRESETS[preset]["mapping"])
        merged.update(mapping)
        mapping = merged
    default_class = PRESETS.get(preset or "", {}).get("event_class", "event")

    ingested = 0
    flagged = 0
    react_fired = 0
    alerts_before = len(store.alerts[org_id])
    inc_before = len(store.incidents[org_id])
    by_class: Counter[str] = Counter()
    by_day: Counter[str] = Counter()
    top_actors: Counter[str] = Counter()
    top_targets: Counter[str] = Counter()
    total_amount = 0.0
    bc = 0
    batch_size = FILE_BATCH_SIZE if fast else BATCH_SIZE

    with open(path, "r", newline="", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            if ingested >= max_rows:
                break
            try:
                ev = map_row(org_id, raw_row, mapping,
                             default_event_class=default_class, preset=preset)
            except Exception:
                continue
            flagged_row = bool(ev.attributes.get("is_fraud") or ev.attributes.get("is_laundering"))
            if fast and not flagged_row:
                _grade_event_risk(ev)
                store.add_event(ev)
            else:
                out = process_event(ev)
                if out.alerts:
                    flagged += 1
                elif flagged_row:
                    iid = _force_incident(org_id, ev)
                    flagged += 1
                    if react_fired < REACT_CAP:
                        from . import reactions
                        _inc = store.get_incident(org_id, iid)
                        if _inc is not None:
                            reactions.on_incident_bg(org_id, _inc)
                            react_fired += 1
            ingested += 1
            by_class[ev.event_class] += 1
            by_day[ev.ts[:10]] += 1
            if ev.event_class == "access":
                if ev.actor.ip:
                    top_actors[str(ev.actor.ip)] += 1
                if ev.actor.user:
                    top_targets[str(ev.actor.user)] += 1
            else:
                if ev.actor.account or ev.actor.user:
                    top_actors[str(ev.actor.account or ev.actor.user)] += 1
                if ev.target.account or ev.target.resource:
                    top_targets[str(ev.target.account or ev.target.resource)] += 1
            total_amount += ev.metrics.get("amount", 0.0)
            bc += 1
            if bc >= batch_size:
                bc = 0
                if len(store.events[org_id]) > RAW_TAIL:
                    store.events[org_id] = store.events[org_id][-RAW_TAIL:]

    if len(store.events[org_id]) > RAW_TAIL:
        store.events[org_id] = store.events[org_id][-RAW_TAIL:]

    elapsed = max(time.perf_counter() - t0, 1e-6)
    return {
        "ingested": ingested,
        "alerts": max(len(store.alerts[org_id]) - alerts_before, 0),
        "incidents": max(len(store.incidents[org_id]) - inc_before, 0),
        "flagged_events": flagged,
        "elapsed_sec": round(elapsed, 3),
        "throughput_eps": round(ingested / elapsed, 1),
        "preset": preset,
        "aggregates": {
            "by_class": dict(by_class),
            "by_day": dict(sorted(by_day.items())),
            "top_actors": top_actors.most_common(10),
            "top_targets": top_targets.most_common(10),
            "total_amount": round(total_amount, 2),
        },
        "raw_retained": len(store.events[org_id]),
    }


def find_dataset(name: str) -> Optional[str]:
    import glob
    import os
    here = os.path.dirname(__file__)
    candidates: list[str] = []
    if name == "paysim":
        candidates = [
            os.environ.get("RETKER_PAYSIM", ""),
            "/app/data/paysim.csv",
            "/opt/retker/data/paysim.csv",
            os.path.join(here, "..", "..", "data", "raw", "paysim", "*.csv"),
            os.path.join(here, "..", "data", "paysim.csv"),
        ]
    for c in candidates:
        if not c:
            continue
        if "*" in c:
            hits = sorted(glob.glob(c))
            if hits:
                return hits[0]
        elif os.path.exists(c):
            return c
    return None
