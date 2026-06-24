from __future__ import annotations

import math
import re
import time
from collections import Counter, defaultdict

from ..store import store

_WORD = re.compile(r"[a-zа-яё0-9]+", re.IGNORECASE)

CLASS_LABEL = {
    "access": "Доступ / вход",
    "data_activity": "Данные / выгрузка",
    "transaction": "Транзакция",
    "email": "Почта / фишинг",
    "web": "Почта / фишинг",
    "network_flow": "Сеть",
}

_CLASS_GLOSS = {
    "access": "вход доступ логин авторизация сессия устройство страна",
    "data_activity": "выгрузка данные экспорт скачивание утечка база записи",
    "transaction": "транзакция перевод платёж обнал вывод средств финанс сумма",
    "email": "письмо почта фишинг ссылка домен отправитель",
    "web": "ссылка домен фишинг url",
}

_DET_GLOSS = {
    "impossible_travel": "невозможная поездка перемещение география скорость",
    "brute_force": "брутфорс подбор пароля неудачные входы",
    "credential_stuffing": "перебор учёток stuffing",
    "new_country": "новая страна гео",
    "new_device": "новое устройство",
    "ueba": "аномалия поведение нетипично",
    "ueba_bulk_export": "массовая выгрузка аномалия инсайдер",
    "dlp_iin": "иин персональные данные утечка",
    "dlp_card": "карта платёжные данные утечка",
    "dlp_secret": "секрет токен ключ",
    "phishing_domain": "фишинг домен омоглиф punycode",
    "fraud_rule": "фрод отмыв подозрительная операция",
    "threat": "модель риск скоринг",
}

_SYNONYMS = {
    "вход": "access login", "входы": "access login", "логин": "access login",
    "авторизац": "access login", "сессия": "access",
    "выгруз": "data_activity export bulk_export", "скач": "data_activity export",
    "экспорт": "data_activity export", "утечк": "leak dlp data_activity",
    "транзакц": "transaction", "перевод": "transaction transfer",
    "обнал": "transaction cash_out", "платёж": "transaction payment", "платеж": "transaction payment",
    "вывод": "transaction cash_out",
    "письм": "email phishing", "почт": "email", "фишинг": "email phishing_domain",
    "ссылк": "email url", "домен": "email phishing_domain",
    "брутфорс": "brute_force", "подбор": "brute_force",
    "иин": "dlp_iin", "карт": "dlp_card", "секрет": "dlp_secret",
    "аномал": "ueba", "инсайдер": "ueba bulk_export",
    "крит": "severity5 severity4", "опасн": "severity5 severity4 high",
}

_NIGHT = ("ноч", "ночн", "night")


def _tok(text: str) -> list[str]:
    return [w.lower() for w in _WORD.findall(text or "")]


def _expand(query: str) -> tuple[list[str], bool]:
    base = _tok(query)
    out = list(base)
    night = any(any(n in t for n in _NIGHT) for t in base)
    for t in base:
        for key, repl in _SYNONYMS.items():
            if key in t:
                out.extend(repl.split())
    return out, night


def _doc(e) -> str:
    parts = [
        e.event_class, _CLASS_LABEL_TOK(e.event_class), e.action or "",
        e.actor.user or "", e.actor.account or "", e.actor.ip or "", e.actor.country or "",
        e.target.resource or "", e.target.url or "", e.target.host or "",
        " ".join(e.risk.detectors), f"severity{e.risk.severity}",
        _CLASS_GLOSS.get(e.event_class, ""),
        " ".join(_DET_GLOSS.get(d, "") for d in e.risk.detectors),
    ]
    return " ".join(p for p in parts if p)


def _CLASS_LABEL_TOK(cls: str) -> str:
    return CLASS_LABEL.get(cls, cls or "")


def _hour(ts: str) -> int:
    try:
        from datetime import datetime
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
    except Exception:
        return 12


def _sev_band(s: int) -> str:
    return "критичный" if s >= 5 else "высокий" if s == 4 else "средний" if s == 3 else "низкий"


def search(org_id: str, query: str, limit: int = 20) -> dict:
    t0 = time.perf_counter()
    events = store.events[org_id]
    q_tokens, night = _expand(query)

    docs = [(e, Counter(_tok(_doc(e)))) for e in events]
    n = len(docs) or 1
    df: Counter = Counter()
    for _, tf in docs:
        for term in tf:
            df[term] += 1

    avgdl = sum(sum(tf.values()) for _, tf in docs) / n if docs else 1.0
    k1, b = 1.5, 0.75
    qset = list(dict.fromkeys(q_tokens))

    scored = []
    for e, tf in docs:
        if night and not (0 <= _hour(e.ts) <= 5):
            continue
        dl = sum(tf.values()) or 1
        score = 0.0
        matched = set()
        for term in qset:
            f = tf.get(term, 0)
            if not f:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl))
            matched.add(term)
        if e.risk.severity >= 4:
            score *= 1.0 + 0.06 * e.risk.severity
        if score > 0 or (night and not qset):
            scored.append((score, e, matched))

    scored.sort(key=lambda x: (x[0], x[1].risk.severity), reverse=True)
    total = len(scored)

    by_class: Counter = Counter()
    by_sev: Counter = Counter()
    by_det: Counter = Counter()
    for _, e, _m in scored:
        by_class[e.event_class] += 1
        by_sev[_sev_band(e.risk.severity)] += 1
        for d in e.risk.detectors:
            by_det[d] += 1

    results = []
    for score, e, matched in scored[:limit]:
        results.append({
            "event_id": e.event_id,
            "ts": e.ts,
            "event_class": e.event_class,
            "class_label": CLASS_LABEL.get(e.event_class, e.event_class),
            "action": e.action,
            "actor": e.actor.user or e.actor.account,
            "ip": e.actor.ip,
            "country": e.actor.country,
            "severity": e.risk.severity,
            "severity_band": _sev_band(e.risk.severity),
            "score": round(float(score), 3),
            "detectors": e.risk.detectors,
            "matched": sorted(matched),
        })

    return {
        "query": query,
        "total": total,
        "took_ms": round((time.perf_counter() - t0) * 1000, 1),
        "results": results,
        "facets": {
            "by_class": [
                {"key": c, "label": CLASS_LABEL.get(c, c), "count": cnt}
                for c, cnt in by_class.most_common()
            ],
            "by_severity": [
                {"key": k, "count": cnt}
                for k, cnt in sorted(by_sev.items(),
                                     key=lambda kv: ["низкий", "средний", "высокий", "критичный"].index(kv[0]),
                                     reverse=True)
            ],
            "by_detector": [
                {"key": d, "count": cnt} for d, cnt in by_det.most_common(6)
            ],
        },
    }
