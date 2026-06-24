from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import scenario
from .chat_routes import chat_router
from .config import CORS_ORIGINS
from .routers import ROUTERS
from .search_routes import search_router
from .security import hash_password
from .store import store

DEMO_KEY = "demo-key-123"


def seed_demo() -> None:
    if "demo" in store.users_by_name:
        return
    org = store.create_org("АО «Демо Банк»")
    store.org_by_key.pop(org.api_key, None)
    org.api_key = DEMO_KEY
    store.org_by_key[DEMO_KEY] = org
    store.create_user("demo", hash_password("demo12345"), org.id)
    scenario.seed(org.id)

    store.add_source(org.id, "Демо-коннектор", "full", DEMO_KEY)
    store.create_source(org.id, "IAM прод", "ingest")
    store.create_source(org.id, "Платёжный шлюз", "ingest")
    store.create_source(org.id, "Аудитор", "read")
    for ev in store.events[org.id]:
        if ev.event_class == "transaction":
            ev.source = "Платёжный шлюз"
        elif ev.event_class == "access":
            ev.source = "IAM прод"
        else:
            ev.source = "Демо-коннектор"
    for ak in store.list_sources(org.id):
        evs = [e for e in store.events[org.id] if e.source == ak.name]
        ak.event_count = len(evs)
        if evs:
            ak.last_seen = max(e.ts for e in evs)


TEST_ACCOUNTS = [
    ("test1", "test12345", "test-key-1", "Тест-орг 1"),
    ("test2", "test12345", "test-key-2", "Тест-орг 2"),
    ("test3", "test12345", "test-key-3", "Тест-орг 3"),
]


def seed_test_orgs() -> None:
    for username, password, key, org_name in TEST_ACCOUNTS:
        if username in store.users_by_name:
            continue
        org = store.create_org(org_name)
        store.org_by_key.pop(org.api_key, None)
        org.api_key = key
        store.org_by_key[key] = org
        store.create_user(username, hash_password(password), org.id)
        store.add_source(org.id, "Тест-коннектор", "full", key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo()
    seed_test_orgs()
    yield


OPENAPI_TAGS = [
    {"name": "auth", "description": "Регистрация, вход (JWT), профиль организации."},
    {"name": "ingest", "description": "Приём событий: 4 типизированные двери "
        "(access / transaction / data / email) приводятся к единому CanonicalEvent. "
        "Авторизация заголовком X-Org-Key."},
    {"name": "app", "description": "Дашборд: обзор, события, инциденты, реакция, "
        "NL-запросы, AI-чат, отчёты, источники. Авторизация Bearer-токеном."},
]

DESCRIPTION = (
    "AI-центр мониторинга безопасности (AI-SOC) для финразведки.\n\n"
    "Принимает поток событий организации, находит угрозы единой обученной моделью "
    "(`unified_threat`, ROC-AUC 0.98 по векторам), объясняет их на русском и помогает "
    "реагировать. LLM-провайдеры за абстракцией с фолбеком: Gemini → OpenAI → Anthropic → "
    "детерминированные шаблоны. Мультитенант по org_id.\n\n"
    "Авторизация: приём событий — заголовок `X-Org-Key`; дашборд — `Authorization: Bearer <token>` "
    "(получить через `/v1/auth/login`)."
)

app = FastAPI(
    title="retker API",
    version="0.1.0",
    description=DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in ROUTERS:
    app.include_router(r)
app.include_router(chat_router)
app.include_router(search_router)


@app.get("/")
def health():
    return {"service": "retker", "status": "ok"}
