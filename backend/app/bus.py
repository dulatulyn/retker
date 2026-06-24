from __future__ import annotations

import asyncio
from collections import defaultdict


class Bus:

    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, org_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs[org_id].add(q)
        return q

    def unsubscribe(self, org_id: str, q: asyncio.Queue) -> None:
        self._subs[org_id].discard(q)

    def publish(self, org_id: str, type_: str, data: dict) -> None:
        for q in list(self._subs[org_id]):
            try:
                q.put_nowait({"type": type_, "data": data})
            except Exception:
                pass


bus = Bus()
