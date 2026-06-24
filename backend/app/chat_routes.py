from __future__ import annotations

import asyncio
import json
import threading
import time

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from .ai import analyst, chat_stream
from .ai.providers import router as ai_router
from .security import _decode, create_token, get_current_org
from .store import Org, store

chat_router = APIRouter(prefix="/v1", tags=["chat"])


@chat_router.get("/chat/demo-token")
def demo_token():
    u = store.users_by_name.get("demo")
    if not u:
        raise HTTPException(503, "демо недоступно")
    return {"token": create_token(u.id, u.org_id)}


@chat_router.get("/chats")
def chats_list(org: Org = Depends(get_current_org)):
    return chat_stream.list_chats(org.id)


@chat_router.post("/chats")
def chats_create(org: Org = Depends(get_current_org)):
    return chat_stream.create_chat(org.id)


@chat_router.get("/chats/{cid}")
def chats_get(cid: str, org: Org = Depends(get_current_org)):
    chat = chat_stream.get_chat(org.id, cid)
    if not chat:
        raise HTTPException(404, "Чат не найден")
    return chat


@chat_router.delete("/chats/{cid}")
def chats_delete(cid: str, org: Org = Depends(get_current_org)):
    chat_stream.delete_chat(org.id, cid)
    return {"ok": True}


def _org_from_token(token: str | None) -> Org | None:
    if not token:
        return None
    try:
        org_id = _decode(token).get("org_id")
    except Exception:
        return None
    return store.orgs.get(org_id)


async def _bridge(gen_factory):
    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()
    DONE = object()

    def worker():
        try:
            for item in gen_factory():
                loop.call_soon_threadsafe(q.put_nowait, ("ev", item))
        except Exception as e:  # noqa: BLE001
            loop.call_soon_threadsafe(q.put_nowait, ("err", e))
        finally:
            loop.call_soon_threadsafe(q.put_nowait, ("done", DONE))

    threading.Thread(target=worker, daemon=True).start()
    while True:
        kind, payload = await q.get()
        if kind == "done":
            return
        yield kind, payload


async def _send_typed(ws: WebSocket, text: str, buf: list) -> None:
    for piece in chat_stream.chunk_text(text):
        buf.append(piece)
        await ws.send_json({"type": "delta", "text": piece})
        await asyncio.sleep(0.012)


@chat_router.websocket("/chat/ws")
async def chat_ws(ws: WebSocket):
    org = _org_from_token(ws.query_params.get("token"))
    if not org:
        await ws.close(code=4401)
        return
    await ws.accept()

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            message = (data.get("message") or "").strip()
            if not message:
                continue

            cid = data.get("chat_id")
            chat = chat_stream.get_chat(org.id, cid) if cid else None
            if not chat:
                chat = chat_stream.create_chat(org.id)
            cid = chat["id"]

            history = [{"role": m["role"], "content": m["content"]} for m in chat["messages"]]
            chat_stream.append_message(org.id, cid, "user", message)
            await ws.send_json({"type": "chat", "chat_id": cid, "title": chat["title"]})

            t0 = time.perf_counter()
            tools: list[str] = []
            buf: list[str] = []
            online = ai_router.available()

            async for kind, payload in _bridge(
                lambda: chat_stream.stream_chat(org.id, message, history)
            ):
                if kind == "err":
                    if not buf:
                        await _send_typed(ws, analyst._chat_fallback(org.id, message), buf)
                    break
                ev = payload
                etype = ev.get("type")
                if etype == "tool":
                    tools.append(ev.get("tool"))
                    await ws.send_json(ev)
                elif etype == "tool_result":
                    await ws.send_json(ev)
                elif etype == "delta":
                    buf.append(ev["text"])
                    await ws.send_json(ev)

            full = "".join(buf).strip() or analyst._chat_fallback(org.id, message)
            chat_stream.append_message(org.id, cid, "assistant", full, tools=tools)
            await ws.send_json({
                "type": "done",
                "chat_id": cid,
                "suggestions": analyst._suggest(org.id),
                "online": online,
                "provider": ai_router.last_provider,
                "elapsed": round(time.perf_counter() - t0, 1),
                "tools": tools,
            })
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await ws.send_json({"type": "error", "message": "Ошибка ассистента"})
        except Exception:
            pass
