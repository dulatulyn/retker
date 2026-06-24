from __future__ import annotations

import json
from collections import defaultdict
import re
from datetime import datetime, timezone

import httpx

from ..store import nid
from . import settings
from .agent import _parse_json
from .prompts import agent_system
from .providers import AllProvidersFailed, router
from .tools import run_tool

_CHATS: dict[str, dict[str, dict]] = defaultdict(dict)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_chat(org_id: str, title: str = "Новый чат") -> dict:
    chat = {"id": nid("chat"), "title": title,
            "created_at": _now(), "updated_at": _now(), "messages": []}
    _CHATS[org_id][chat["id"]] = chat
    return chat


def get_chat(org_id: str, cid: str) -> dict | None:
    return _CHATS[org_id].get(cid)


def list_chats(org_id: str) -> list[dict]:
    items = [{"id": c["id"], "title": c["title"], "created_at": c["created_at"],
              "updated_at": c["updated_at"], "count": len(c["messages"])}
             for c in _CHATS[org_id].values()]
    return sorted(items, key=lambda c: c["updated_at"], reverse=True)


def delete_chat(org_id: str, cid: str) -> None:
    _CHATS[org_id].pop(cid, None)


def append_message(org_id: str, cid: str, role: str, content: str,
                   tools: list | None = None) -> None:
    chat = _CHATS[org_id].get(cid)
    if not chat:
        return
    chat["messages"].append({"role": role, "content": content,
                             "tools": tools or [], "ts": _now()})
    chat["updated_at"] = _now()
    if role == "user" and chat["title"] == "Новый чат" and content.strip():
        chat["title"] = content.strip()[:48]


CHAT_FINAL_SYSTEM = (
    "Ты — AI-аналитик безопасности retker, отвечаешь офицеру безопасности на русском.\n"
    "Дай КОРОТКИЙ ответ: 2–4 предложения или маркированный список. "
    "Можно markdown: **жирный**, списки через «- », `код`, ### заголовки.\n"
    "Конкретные факты (числа, имена, инциденты, логи) бери ТОЛЬКО из наблюдений — не выдумывай. "
    "Эти данные УЖЕ показаны пользователю таблицами/логами/диаграммами рядом с ответом — "
    "просто прокомментируй их. "
    "НИКОГДА не отказывайся и не пиши «не могу предоставить логи/данные/график» и не проси "
    "«предоставить данные»: данные уже добыты инструментами. "
    "Если в наблюдениях по запросу пусто — скажи, что по этому фильтру ничего не нашлось. "
    "На общие вопросы (что делать, как реагировать) отвечай по своим знаниям ИБ."
)


def _any(ql: str, *hints: str) -> bool:
    return any(h in ql for h in hints)


_USER_RE = re.compile(r'(?<![\w.-])([a-zа-яё]{1,12}\.[a-zа-яё]{2,20})(?![\w.-])')
_COUNTRY_KW = [("корея", "KR"), ("сеул", "KR"), ("росси", "RU"), ("казах", "KZ"),
               ("алмат", "KZ"), ("астан", "KZ"), ("сша", "US"), ("америк", "US"), ("китай", "CN")]


def _log_args(ql: str) -> dict:
    args: dict = {"limit": 20}
    if "ноч" in ql:
        args["night"] = True
    if _any(ql, "вход", "логин", "доступ"):
        args["event_class"] = "access"
    elif _any(ql, "выгруз", "скач", "баз", "экспорт"):
        args["event_class"] = "data_activity"
    elif _any(ql, "транзак", "перевод", "обнал", "платеж"):
        args["event_class"] = "transaction"
    elif _any(ql, "почт", "письм", "email"):
        args["event_class"] = "email"
    mu = _USER_RE.search(ql)
    if mu:
        args["user"] = mu.group(1)
    else:
        m2 = re.search(r'(?:пользовател[а-я]*|аккаунт[а-я]*|юзер[а-я]*|user)\s+["«]?([a-zа-яё0-9._-]{2,})', ql)
        if m2:
            args["user"] = m2.group(1).strip('"«»')
    for kw, code in _COUNTRY_KW:
        if kw in ql:
            args["country"] = code
            break
    if _any(ql, "неуспешн", "неудачн", "фейл", "failed", "провал", "не уда"):
        args["action"] = "login_failed"
    elif "успешн" in ql:
        args["action"] = "login_success"
    if _any(ql, "критич", "crit", "опасн", "высок"):
        args["min_severity"] = 4
    return args


def _preroute(q: str) -> list[tuple[str, dict]]:
    ql = q.lower()
    out: list[tuple[str, dict]] = []

    if _any(ql, "график", "граф", "диаграм", "чарт", "chart", "статист", "сводк",
            "обзор", "разбивк", "по категори", "по типу", "метрик", "дашборд",
            "сколько", "распределен", "визуализ"):
        out.append(("get_stats", {}))

    if _any(ql, "инцидент", "incident", "кейс"):
        ia: dict = {}
        if "открыт" in ql:
            ia["status"] = "open"
        elif _any(ql, "заблок", "блокир"):
            ia["status"] = "blocked"
        elif "закрыт" in ql:
            ia["status"] = "closed"
        out.append(("list_incidents", ia))

    if _any(ql, "утечк", "иин", "dlp", "карт", "персональн", "секрет"):
        out.append(("get_alerts", {"category": "leak"}))
    if _any(ql, "фишинг", "phish", "домен", "kaspi", "xn--", "punycode", "ссылк"):
        out.append(("get_alerts", {"category": "phishing"}))
    if _any(ql, "фрод", "мошенн", "обнал", "отмыв"):
        out.append(("get_alerts", {"category": "fraud"}))
    if _any(ql, "алерт", "тревог", "сработ", "детектор"):
        out.append(("get_alerts", {}))

    has_user = bool(_USER_RE.search(ql)) or _any(ql, "пользовател", "аккаунт", "юзер")
    if has_user or _any(ql, "лог", "событи", "event", "вход", "логин", "доступ", "выгруз",
                        "скач", "экспорт", "транзак", "перевод", "почт", "письм", "трафик"):
        out.append(("search_logs", _log_args(ql)))

    seen, dedup = set(), []
    for name, a in out:
        key = (name, tuple(sorted(a.items())))
        if key not in seen:
            seen.add(key)
            dedup.append((name, a))
    return dedup[:3]


def _history_msgs(history) -> list[dict]:
    out: list[dict] = []
    for h in (history or [])[-8:]:
        role = h.get("role") if isinstance(h, dict) else None
        content = h.get("content") if isinstance(h, dict) else None
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out


def _provider_chain() -> list[tuple[str, str, str]]:
    keys = {
        "gemini": (settings.GEMINI_API_KEY, settings.GEMINI_MODEL),
        "openai": (settings.OPENAI_API_KEY, settings.OPENAI_MODEL),
        "anthropic": (settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL),
    }
    chain = []
    for name in settings.PROVIDER_ORDER:
        key, model = keys.get(name, ("", ""))
        if key:
            chain.append((name, key, model))
    return chain


def _stream_openai(key, model, system, messages, max_tokens):
    msgs = ([{"role": "system", "content": system}] if system else []) + messages
    body = {"model": model, "messages": msgs, "temperature": settings.TEMPERATURE,
            "max_tokens": max_tokens, "stream": True}
    with httpx.stream("POST", "https://api.openai.com/v1/chat/completions",
                      headers={"Authorization": f"Bearer {key}"},
                      json=body, timeout=settings.HTTP_TIMEOUT) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                ev = json.loads(payload)
            except Exception:
                continue
            delta = (ev.get("choices") or [{}])[0].get("delta", {}).get("content")
            if delta:
                yield delta


def _stream_anthropic(key, model, system, messages, max_tokens):
    body = {"model": model, "max_tokens": max_tokens, "temperature": settings.TEMPERATURE,
            "messages": messages, "stream": True}
    if system:
        body["system"] = system
    with httpx.stream("POST", "https://api.anthropic.com/v1/messages",
                      headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                               "content-type": "application/json"},
                      json=body, timeout=settings.HTTP_TIMEOUT) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except Exception:
                continue
            if ev.get("type") == "content_block_delta":
                txt = (ev.get("delta") or {}).get("text")
                if txt:
                    yield txt


def _stream_gemini(key, model, system, messages, max_tokens):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
    contents = [{"role": "model" if m["role"] == "assistant" else "user",
                 "parts": [{"text": m["content"]}]} for m in messages]
    body = {"contents": contents,
            "generationConfig": {"temperature": settings.TEMPERATURE,
                                 "maxOutputTokens": max_tokens,
                                 "thinkingConfig": {"thinkingBudget": 0}}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    with httpx.stream("POST", url, params={"key": key, "alt": "sse"},
                      json=body, timeout=settings.HTTP_TIMEOUT) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except Exception:
                continue
            try:
                txt = ev["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                txt = None
            if txt:
                yield txt


_STREAMERS = {"openai": _stream_openai, "anthropic": _stream_anthropic, "gemini": _stream_gemini}


def stream_chat(org_id: str, question: str, history=None, max_steps: int = 4):
    online = (not settings.OFFLINE) and router.available()

    msgs = _history_msgs(history) + [{"role": "user", "content": question}]
    system = agent_system()
    obs: list[str] = []
    obs_data: list[tuple[str, dict]] = []
    direct: str | None = None

    def _use(name: str, args: dict):
        yield {"type": "tool", "tool": name, "args": args}
        result = run_tool(name, org_id, args)
        yield {"type": "tool_result", "tool": name, "data": result}
        msgs.append({"role": "assistant", "content": json.dumps({"tool": name, "args": args}, ensure_ascii=False)})
        msgs.append({"role": "user", "content": f"НАБЛЮДЕНИЕ ({name}): "
                     + json.dumps(result, ensure_ascii=False, default=str)})
        obs.append(f"[{name}] " + json.dumps(result, ensure_ascii=False, default=str)[:1800])
        obs_data.append((name, result))

    prerouted = _preroute(question)
    for name, args in prerouted:
        yield from _use(name, args)

    if online and not prerouted:
        for _ in range(max_steps):
            try:
                raw = router.complete(system, msgs, json_mode=True, max_tokens=512)
            except AllProvidersFailed:
                online = False
                break
            obj = _parse_json(raw)
            if obj is None:
                direct = (raw or "").strip()
                break
            if "tool" in obj:
                name = str(obj["tool"])
                args = obj.get("args") or {}
                if not isinstance(args, dict):
                    args = {}
                yield from _use(name, args)
                continue
            break

    if direct:
        yield {"type": "delta", "text": direct}
        return

    if online:
        context = "\n".join(obs)
        final_user = question if not context else f"{question}\n\nДанные из инструментов:\n{context}"
        fmsgs = _history_msgs(history) + [{"role": "user", "content": final_user}]
        streamed = False
        for name, key, model in _provider_chain():
            streamer = _STREAMERS.get(name)
            if not streamer:
                continue
            try:
                for chunk in streamer(key, model, CHAT_FINAL_SYSTEM, fmsgs, 400):
                    streamed = True
                    router.last_provider = name
                    yield {"type": "delta", "text": chunk}
                if streamed:
                    return
            except httpx.HTTPError:
                if streamed:
                    return
                continue
        if not streamed:
            try:
                reply = (router.complete(CHAT_FINAL_SYSTEM, fmsgs, max_tokens=400) or "").strip()
                if reply:
                    for piece in chunk_text(reply):
                        yield {"type": "delta", "text": piece}
                    return
            except AllProvidersFailed:
                pass

    for piece in chunk_text(_deterministic_summary(obs_data)):
        yield {"type": "delta", "text": piece}


def _deterministic_summary(obs_data: list[tuple[str, dict]]) -> str:
    if not obs_data:
        return ("Не нашёл точного совпадения. Спросите про **логи**, **инциденты**, "
                "**утечки**, **фишинг** или **фрод** — покажу данные.")
    parts: list[str] = []
    for name, d in obs_data:
        if name == "get_stats":
            parts.append(f"Событий: **{d.get('events', 0)}**, алертов: **{d.get('alerts', 0)}**, "
                         f"инцидентов: **{d.get('incidents', 0)}** (открытых {d.get('open_incidents', 0)}). "
                         "Разбивка по типам угроз — на диаграмме.")
        elif name == "search_logs":
            parts.append(f"Нашёл **{d.get('count', 0)}** событий по запросу — последние показаны ниже.")
        elif name == "list_incidents":
            parts.append(f"Инцидентов: **{d.get('count', 0)}** — список ниже.")
        elif name == "get_alerts":
            parts.append(f"Алертов: **{d.get('count', 0)}** — список ниже.")
        elif name == "get_incident" and not d.get("error"):
            parts.append(f"Инцидент **{d.get('title', '')}**, критичность {d.get('severity', '?')}/5 — детали ниже.")
    return "\n".join(parts) or "Данные показаны ниже."


def chunk_text(text: str):
    buf = ""
    for ch in text:
        buf += ch
        if ch == " " or ch == "\n":
            yield buf
            buf = ""
    if buf:
        yield buf
