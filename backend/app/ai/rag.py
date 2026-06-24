from __future__ import annotations

import math
import re
from collections import Counter, defaultdict

from . import settings

_WORD = re.compile(r"[a-zа-яё0-9]+", re.IGNORECASE)


def _tok(text: str) -> list[str]:
    return [w.lower() for w in _WORD.findall(text)]


class _Corpus:
    def __init__(self) -> None:
        self.docs: list[dict] = []
        self.df: Counter = Counter()
        self._loaded = False

    def add(self, doc_id: str, title: str, text: str) -> None:
        toks = _tok(title + " " + text)
        self.docs.append({"id": doc_id, "title": title, "text": text, "tokens": toks})
        for t in set(toks):
            self.df[t] += 1

    def _idf(self, term: str) -> float:
        n = len(self.docs) or 1
        return math.log(1 + n / (1 + self.df.get(term, 0)))

    def search(self, query: str, k: int = 3) -> list[dict]:
        if not self.docs:
            return []
        qset = set(_tok(query))
        if not qset:
            return []
        scored = []
        for d in self.docs:
            tf = Counter(d["tokens"])
            score = sum(tf[t] * self._idf(t) for t in qset)
            if score > 0:
                scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:k]]


_KB = _Corpus()
_ORG_MEM: dict[str, _Corpus] = defaultdict(_Corpus)


def _load_kb() -> None:
    if _KB._loaded:
        return
    _KB._loaded = True
    d = settings.KNOWLEDGE_DIR
    if not d.exists():
        return
    for path in sorted(d.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        title = text.splitlines()[0].lstrip("# ").strip() if text else path.stem
        _KB.add(path.stem, title, text)


_load_kb()


def search_playbooks(query: str, k: int = 3) -> list[dict]:
    return [{"id": d["id"], "title": d["title"], "text": d["text"]} for d in _KB.search(query, k)]


def remember(org_id: str, doc_id: str, title: str, text: str) -> None:
    _ORG_MEM[org_id].add(doc_id, title, text)


def _attr(obj, name, default=""):
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def set_org_context(org_id: str, text: str) -> None:
    remember(org_id, "org_context", "Контекст организации", text)


def remember_incident(org_id: str, incident) -> None:
    iid = _attr(incident, "id")
    title = f"Инцидент {iid}: {_attr(incident, 'title')}"
    text = (f"{_attr(incident, 'ai_summary')} Гипотеза: {_attr(incident, 'hypothesis')}. "
            f"Статус: {_attr(incident, 'status')}.")
    remember(org_id, f"inc_{iid}", title, text)


def remember_feedback(org_id: str, alert, verdict: str, note: str = "") -> None:
    aid = _attr(alert, "id")
    title = f"Фидбек по «{_attr(alert, 'title')}» → {verdict}"
    text = (f"Детектор {_attr(alert, 'detector')}, сущность {_attr(alert, 'entity')}. "
            f"Вердикт офицера: {verdict}. {note}")
    remember(org_id, f"fb_{aid}", title, text)


def search_org_memory(org_id: str, query: str, k: int = 3) -> list[dict]:
    return [{"id": d["id"], "title": d["title"], "text": d["text"]}
            for d in _ORG_MEM[org_id].search(query, k)]


def context_for(org_id: str, query: str, k: int = 3) -> str:
    chunks: list[str] = []
    for d in search_playbooks(query, k):
        chunks.append(f"[плейбук: {d['title']}]\n{d['text'].strip()}")
    for d in search_org_memory(org_id, query, max(1, k - 1)):
        chunks.append(f"[память орг: {d['title']}]\n{d['text'].strip()}")
    return "\n\n".join(chunks)


def stats() -> dict:
    return {"playbooks": len(_KB.docs), "orgs_with_memory": len(_ORG_MEM)}
