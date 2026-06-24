from __future__ import annotations

import math
import re
import statistics
from collections import Counter
from datetime import datetime

from ..store import store

FRAUD_FEATURES = [
    "amount",
    "type_transfer",
    "type_cash_out",
    "type_payment",
    "type_cash_in",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "balance_delta_org",
]

ANOMALY_FEATURES = [
    "rows",
    "rows_mean",
    "rows_ratio",
    "events_total",
    "hour",
    "is_night",
    "unique_resources",
]

UNIFIED_FEATURES = [
    "ec_transaction", "ec_access", "ec_web",
    "amount", "log_amount",
    "type_transfer", "type_cash_out", "type_payment", "type_cash_in", "type_debit",
    "oldbalanceOrg", "newbalanceOrig", "balance_delta_org",
    "oldbalanceDest", "newbalanceDest", "balance_delta_dest",
    "orig_emptied", "dest_was_empty", "amount_to_orig_ratio",
    "error_balance_orig", "error_balance_dest",
    "failed_logins", "login_success", "src_bytes", "dst_bytes",
    "conn_count", "srv_count", "serror_rate", "same_srv_rate", "diff_srv_rate",
    "dst_host_count", "dst_host_srv_count", "is_guest_login", "num_compromised",
    "hot", "duration",
    "url_length", "num_dots", "num_digits", "num_special", "has_at", "has_ip",
    "has_punycode", "num_subdomains", "has_https", "suspicious_tld", "digit_ratio",
    "has_login_word", "url_entropy",
]

NSL_COLUMNS = [
    "duration", "protocol_type", "service", "flag", "src_bytes", "dst_bytes", "land",
    "wrong_fragment", "urgent", "hot", "num_failed_logins", "logged_in", "num_compromised",
    "root_shell", "su_attempted", "num_root", "num_file_creations", "num_shells",
    "num_access_files", "num_outbound_cmds", "is_host_login", "is_guest_login", "count",
    "srv_count", "serror_rate", "srv_serror_rate", "rerror_rate", "srv_rerror_rate",
    "same_srv_rate", "diff_srv_rate", "srv_diff_host_rate", "dst_host_count",
    "dst_host_srv_count", "dst_host_same_srv_rate", "dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate", "dst_host_srv_diff_host_rate", "dst_host_serror_rate",
    "dst_host_srv_serror_rate", "dst_host_rerror_rate", "dst_host_srv_rerror_rate",
    "label", "difficulty",
]

SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "top", "xyz", "work", "click", "link", "zip",
    "review", "country", "kim", "science", "party", "gdn", "loan", "men", "date",
}

_LOGIN_WORDS = ("login", "secure", "account", "verify", "update", "signin", "bank",
                "confirm", "webscr", "ebayisapi", "paypal", "wp-admin", "password")


def _num(*vals) -> float:
    for v in vals:
        if v is not None and v != "":
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    return 0.0


def _hour(ts: str) -> int:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
    except Exception:
        return 12


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return -sum((k / n) * math.log2(k / n) for k in Counter(s).values())


def transaction_features(event) -> dict[str, float]:
    m = event.metrics or {}
    attrs = event.attributes or {}
    raw = event.raw or {}
    ttype = (event.action or attrs.get("type") or raw.get("type") or "").lower()
    feats: dict[str, float] = {
        "amount": _num(m.get("amount"), attrs.get("amount"), raw.get("amount")),
        "type_transfer": 1.0 if "transfer" in ttype else 0.0,
        "type_cash_out": 1.0 if ("cash_out" in ttype or "обнал" in ttype) else 0.0,
        "type_payment": 1.0 if "payment" in ttype else 0.0,
        "type_cash_in": 1.0 if "cash_in" in ttype else 0.0,
    }
    for k in ("oldbalanceOrg", "newbalanceOrig", "oldbalanceDest", "newbalanceDest"):
        feats[k] = _num(m.get(k), attrs.get(k), raw.get(k))
    feats["balance_delta_org"] = feats["oldbalanceOrg"] - feats["newbalanceOrig"]
    return feats


def user_behavior_features(org_id: str, event) -> dict[str, float]:
    actor = event.actor.user or event.actor.account or ""
    evs = [e for e in store.events[org_id]
           if (e.actor.user or e.actor.account or "") == actor]
    rows_now = _num((event.metrics or {}).get("rows"))
    hist = [_num((e.metrics or {}).get("rows")) for e in evs
            if (e.metrics or {}).get("rows") is not None]
    mean = statistics.mean(hist) if hist else 0.0
    resources = {e.target.resource for e in evs if e.target.resource}
    h = _hour(event.ts)
    return {
        "rows": rows_now,
        "rows_mean": round(mean, 2),
        "rows_ratio": round(rows_now / mean, 2) if mean else 0.0,
        "events_total": float(len(evs)),
        "hour": float(h),
        "is_night": 1.0 if 0 <= h <= 5 else 0.0,
        "unique_resources": float(len(resources)),
    }


def tx_features(amount, ttype, old_org, new_org, old_dest, new_dest) -> dict[str, float]:
    t = (ttype or "").upper()
    amount = _num(amount)
    old_org, new_org = _num(old_org), _num(new_org)
    old_dest, new_dest = _num(old_dest), _num(new_dest)
    return {
        "amount": amount,
        "log_amount": math.log1p(amount) if amount > 0 else 0.0,
        "type_transfer": 1.0 if t == "TRANSFER" else 0.0,
        "type_cash_out": 1.0 if t == "CASH_OUT" else 0.0,
        "type_payment": 1.0 if t == "PAYMENT" else 0.0,
        "type_cash_in": 1.0 if t == "CASH_IN" else 0.0,
        "type_debit": 1.0 if t == "DEBIT" else 0.0,
        "oldbalanceOrg": old_org,
        "newbalanceOrig": new_org,
        "balance_delta_org": old_org - new_org,
        "oldbalanceDest": old_dest,
        "newbalanceDest": new_dest,
        "balance_delta_dest": new_dest - old_dest,
        "orig_emptied": 1.0 if (old_org > 0 and new_org == 0) else 0.0,
        "dest_was_empty": 1.0 if old_dest == 0 else 0.0,
        "amount_to_orig_ratio": amount / (old_org + 1.0),
        "error_balance_orig": old_org - amount - new_org,
        "error_balance_dest": new_dest - old_dest - amount,
    }


def url_features(url) -> dict[str, float]:
    u = (url or "").strip()
    low = u.lower()
    host = re.sub(r"^https?://", "", low).split("/")[0]
    tld = host.rsplit(".", 1)[-1] if "." in host else ""
    digits = sum(ch.isdigit() for ch in u)
    special = sum((not ch.isalnum()) for ch in u)
    return {
        "url_length": float(len(u)),
        "num_dots": float(u.count(".")),
        "num_digits": float(digits),
        "num_special": float(special),
        "has_at": 1.0 if "@" in u else 0.0,
        "has_ip": 1.0 if re.match(r"^(https?://)?\d{1,3}(\.\d{1,3}){3}", low) else 0.0,
        "has_punycode": 1.0 if "xn--" in low else 0.0,
        "num_subdomains": float(max(host.count(".") - 1, 0)),
        "has_https": 1.0 if low.startswith("https") else 0.0,
        "suspicious_tld": 1.0 if tld in SUSPICIOUS_TLDS else 0.0,
        "digit_ratio": digits / len(u) if u else 0.0,
        "has_login_word": 1.0 if any(w in low for w in _LOGIN_WORDS) else 0.0,
        "url_entropy": round(_entropy(u), 3),
    }


def nsl_features(d: dict) -> dict[str, float]:
    def g(k):
        return _num(d.get(k))
    return {
        "failed_logins": g("num_failed_logins"),
        "login_success": g("logged_in"),
        "src_bytes": g("src_bytes"),
        "dst_bytes": g("dst_bytes"),
        "conn_count": g("count"),
        "srv_count": g("srv_count"),
        "serror_rate": g("serror_rate"),
        "same_srv_rate": g("same_srv_rate"),
        "diff_srv_rate": g("diff_srv_rate"),
        "dst_host_count": g("dst_host_count"),
        "dst_host_srv_count": g("dst_host_srv_count"),
        "is_guest_login": g("is_guest_login"),
        "num_compromised": g("num_compromised"),
        "hot": g("hot"),
        "duration": g("duration"),
    }


def access_login_features(event) -> dict[str, float]:
    ev = getattr(event, "evidence", None) or {}
    action = (event.action or "").lower()
    success = 1.0 if action.endswith("success") or action == "login_success" else 0.0
    return {
        "failed_logins": _num(ev.get("fails")),
        "login_success": success,
    }


_EC_MAP = {"transaction": "ec_transaction", "access": "ec_access",
           "email": "ec_web", "web": "ec_web", "data_activity": "ec_access"}


def to_row(feats: dict, event_class: str) -> list[float]:
    ec = _EC_MAP.get(event_class)
    row: list[float] = []
    for name in UNIFIED_FEATURES:
        if name in ("ec_transaction", "ec_access", "ec_web"):
            row.append(1.0 if name == ec else 0.0)
        else:
            row.append(float(feats.get(name, float("nan"))))
    return row


def unified_features(event, org_id: str = "") -> dict[str, float]:
    cls = event.event_class
    if cls == "transaction":
        m = event.metrics or {}
        a = event.attributes or {}
        r = event.raw or {}
        return tx_features(
            m.get("amount") or a.get("amount") or r.get("amount"),
            event.action or a.get("type") or r.get("type"),
            m.get("old_balance_orig") or m.get("oldbalanceOrg") or r.get("oldbalanceOrg"),
            m.get("new_balance_orig") or m.get("newbalanceOrig") or r.get("newbalanceOrig"),
            m.get("old_balance_dest") or m.get("oldbalanceDest") or r.get("oldbalanceDest"),
            m.get("new_balance_dest") or m.get("newbalanceDest") or r.get("newbalanceDest"),
        )
    if cls in ("email", "web"):
        links = (event.attributes or {}).get("links") or (event.raw or {}).get("links") or []
        url = ((event.target.url if event.target else None)
               or (links[0] if links else "")
               or (event.raw or {}).get("url", ""))
        return url_features(url)
    if cls in ("access", "data_activity"):
        return access_login_features(event)
    return {}
