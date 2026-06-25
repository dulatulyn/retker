# Dev: локальный закрытый контур с Ollama

Локальный/offline-демо стек: API + nginx + локальная модель Ollama в Docker.
Закрытый контур — наружу ходит только локальная модель (`AI_PROVIDER_ORDER=ollama`).

## 3 команды

1. Поднять стек:

   ```
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Скачать модель в контейнер Ollama:

   ```
   docker compose -f docker-compose.dev.yml exec ollama ollama pull qwen2.5:7b
   ```

3. Открыть в браузере:

   http://localhost:8080

## Важно

Это конфигурация **только для локального закрытого контура** (offline-демо).
В прод (`docker-compose.prod.yml`) Ollama **НЕ входит** — прод трогать не нужно.
