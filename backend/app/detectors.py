from __future__ import annotations

import math
import re
from collections import deque
from datetime import datetime

from .schemas import Alert, CanonicalEvent
from .store import nid, store

_COORDS = {
    "KZ": (43.24, 76.95), "KR": (37.57, 126.98), "RU": (55.75, 37.62),
    "NL": (52.37, 4.90), "DE": (52.52, 13.40), "US": (38.9, -77.0),
    "GB": (51.51, -0.13), "CN": (39.9, 116.4), "TR": (41.0, 28.98),
}


def _haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def _epoch(ts: str) -> float:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def _hour(ts: str) -> int:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
    except Exception:
        return 12


def iin_valid(s: str) -> bool:
    if not (len(s) == 12 and s.isdigit()):
        return False
    w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]
    c = sum(int(s[i]) * w1[i] for i in range(11)) % 11
    if c == 10:
        c = sum(int(s[i]) * w2[i] for i in range(11)) % 11
    return c != 10 and c == int(s[11])


def luhn_valid(digits: str) -> bool:
    if not (13 <= len(digits) <= 19 and digits.isdigit()):
        return False
    total, alt = 0, False
    for d in reversed(digits):
        n = int(d)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def _entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {c: s.count(c) for c in set(s)}
    return -sum((n / len(s)) * math.log2(n / len(s)) for n in freq.values())


def _mk(event: CanonicalEvent, detector: str, category: str, severity: int,
        title: str, entity: str, evidence: dict) -> Alert:
    return Alert(
        id=nid("alt"), org_id=event.org_id, ts=event.ts, event_id=event.event_id,
        detector=detector, category=category, severity=severity, title=title,
        entity=entity, evidence=evidence,
    )


def detect_access(e: CanonicalEvent) -> list[Alert]:
    st = store.det_state[e.org_id]
    user = e.actor.user or "unknown"
    country = e.actor.country
    out: list[Alert] = []

    if e.attributes.get("success") is False:
        fails = st["fails"].setdefault(user, deque())
        t = _epoch(e.ts)
        fails.append(t)
        while fails and t - fails[0] > 60:
            fails.popleft()
        if len(fails) >= 5:
            bf = st["bf_alert"]
            if t - bf.get(user, 0.0) >= 30:
                bf[user] = t
                out.append(_mk(e, "brute_force", "access", 3,
                               f"Брутфорс: {len(fails)} неудачных входов за 60с", user,
                               {"fails": len(fails), "ip": e.actor.ip, "country": country}))
        return out

    if country and country in _COORDS:
        last = st["last_login"].get(user)
        t = _epoch(e.ts)
        if last and last["country"] != country and last["country"] in _COORDS:
            dist = _haversine(_COORDS[last["country"]], _COORDS[country])
            hours = max((t - last["t"]) / 3600.0, 1 / 60.0)
            speed = dist / hours
            if speed > 900:
                out.append(_mk(e, "impossible_travel", "access", 4,
                               f"Impossible travel: {last['country']} → {country}", user,
                               {"from": last["country"], "to": country,
                                "km": round(dist), "kmh": round(speed)}))
        seen = st["countries"].setdefault(user, set())
        if seen and country not in seen:
            out.append(_mk(e, "new_country", "access", 2,
                           f"Вход из новой страны: {country}", user,
                           {"country": country, "ip": e.actor.ip}))
        seen.add(country)
        st["last_login"][user] = {"country": country, "t": t}
    return out


_AWS = re.compile(r"AKIA[0-9A-Z]{16}")
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}")


def _scan_dlp(text: str) -> dict:
    hits = {"iin": [], "card": [], "secret": []}
    for m in re.findall(r"\b\d{12}\b", text):
        if iin_valid(m):
            hits["iin"].append(m[:4] + "••••" + m[-2:])
    for m in re.findall(r"\b(?:\d[ -]?){13,19}\b", text):
        digits = re.sub(r"\D", "", m)
        if luhn_valid(digits):
            hits["card"].append("•••• " + digits[-4:])
    if _AWS.search(text) or _JWT.search(text):
        hits["secret"].append("ключ/токен")
    for tok in re.findall(r"\S{20,}", text):
        if _entropy(tok) > 4.0 and not tok.isdigit():
            hits["secret"].append("high-entropy")
            break
    return {k: v for k, v in hits.items() if v}


def detect_data(e: CanonicalEvent) -> list[Alert]:
    user = e.actor.user or "unknown"
    out: list[Alert] = []
    rows = int(e.metrics.get("rows", 0))
    night = 0 <= _hour(e.ts) <= 5

    if e.action in ("export", "download") and rows >= 1000:
        sev = 5 if night else 4
        out.append(_mk(e, "ueba_bulk_export", "anomaly", sev,
                       f"Массовая выгрузка {rows} записей" + (" ночью" if night else ""),
                       user, {"rows": rows, "resource": e.target.resource, "night": night}))

    text = " ".join(filter(None, [e.attributes.get("content"), e.target.resource]))
    hits = _scan_dlp(text or "")
    if hits.get("iin"):
        out.append(_mk(e, "dlp_iin", "leak", 5, f"Утечка ИИН ({len(hits['iin'])})",
                       user, {"samples": hits["iin"][:3]}))
    if hits.get("card"):
        out.append(_mk(e, "dlp_card", "leak", 4, f"Утечка карт ({len(hits['card'])})",
                       user, {"samples": hits["card"][:3]}))
    if hits.get("secret"):
        out.append(_mk(e, "dlp_secret", "leak", 4, "Секрет/токен в данных",
                       user, {"kinds": hits["secret"]}))
    return out


def detect_transaction(e: CanonicalEvent) -> list[Alert]:
    amount = e.metrics.get("amount", 0.0)
    acc = e.actor.account or "unknown"
    score = 0.0
    if e.action == "cash_out":
        score = 0.7 + (0.2 if amount >= 10000 else 0.0)
    elif e.action == "transfer" and amount >= 10000:
        score = 0.55
    if amount and amount % 1000 == 0:
        score += 0.05
    score = round(min(score, 0.97), 2)
    if score >= 0.6:
        return [_mk(e, "fraud_rule", "fraud", 4 if score < 0.85 else 5,
                    f"Подозрительная транзакция ({e.action}, {int(amount)} ₸)", acc,
                    {"score": score, "amount": amount, "type": e.action,
                     "note": "правило-заглушка вместо ML-модели"})]
    return []


_BRANDS = ["kaspi", "halyk", "paypal", "google", "egov", "jusan"]
_BAD_TLD = (".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".xyz")


def _domain(url: str) -> str:
    return re.sub(r"^https?://", "", url).split("/")[0].lower()


def detect_email(e: CanonicalEvent) -> list[Alert]:
    out: list[Alert] = []
    for url in e.attributes.get("links", []) or []:
        dom = _domain(url)
        flags = []
        if "xn--" in dom:
            flags.append("punycode/омоглиф")
        if dom.endswith(_BAD_TLD):
            flags.append("подозрительный TLD")
        if any(b in dom for b in _BRANDS) and not any(dom.endswith(b + ".kz") for b in _BRANDS):
            flags.append("имитация бренда")
        if flags:
            out.append(_mk(e, "phishing_domain", "phishing", 3,
                           f"Фишинговый домен: {dom}", dom,
                           {"url": url, "flags": flags, "subject": e.attributes.get("subject")}))
    return out


DISPATCH = {
    "access": detect_access,
    "data_activity": detect_data,
    "transaction": detect_transaction,
    "email": detect_email,
}


def run_detectors(e: CanonicalEvent) -> list[Alert]:
    fn = DISPATCH.get(e.event_class)
    return fn(e) if fn else []
