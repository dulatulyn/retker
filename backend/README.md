# retker — backend (FastAPI)

AI-SOC бэкенд: приём событий (4 типизированных эндпоинта) → нормализация в CanonicalEvent
→ детекторы (правила) + мок-AI-слой → инциденты → SSE-поток. Мультитенант по `X-Org-Key`.
JWT-авторизация. **ML-модель и реальный LLM пока заглушены моками** (подключим позже).

## Запуск
```bash
cd backend
python3 -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

## Демо-аккаунт (создаётся при старте)
- username: `demo`  ·  password: `demo12345`
- org API-key: `demo-key-123`

## Поток
```
POST /v1/events/{access|transaction|data|email}  (X-Org-Key или Bearer)
   → normalize → CanonicalEvent → детекторы → корреляция в инцидент → SSE /v1/stream
GET  /v1/overview · /v1/incidents · /v1/incidents/{id} · POST /v1/incidents/{id}/block
POST /v1/query · GET /v1/reports/{incident_id} · POST /v1/replay  (демо-сценарий)
```

## Что мок (заменим позже)
- `brain.py` — объяснения/корреляция/отчёт/NL-запрос: пока детерминированные шаблоны
  (интерфейс готов под реальный LLM за абстракцией).
- скоринг транзакций — пока правило-заглушка вместо ML-модели.

## Smoke-test
```bash
python3 backend/smoke_test.py
```
