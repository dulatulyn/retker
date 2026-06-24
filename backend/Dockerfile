# retker API — FastAPI на uvicorn. Контекст сборки = корень репозитория
# (нужен и backend/, и ml/ для AI-скоринга). Собирать: docker build -f backend/Dockerfile .
# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# зависимости отдельным слоем для кэша
COPY backend/requirements.txt backend/requirements-ai.txt /app/backend/
RUN pip install --no-cache-dir -r /app/backend/requirements.txt -r /app/backend/requirements-ai.txt

# код приложения + ML-артефакты (модель фрода/угроз грузится из ../ml относительно backend)
COPY backend /app/backend
COPY ml /app/ml

WORKDIR /app/backend
EXPOSE 8000

# ВАЖНО: in-memory store → ровно ОДИН воркер и ОДНА реплика,
# иначе данные/инциденты разъедутся по процессам.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
