# Деплой retker (co-host на VM с asynkor)

retker подселяется на ту же Hetzner-VM (`167.233.124.48`, сервер `asynkor`), где уже
работает asynkor (проект `coframe`). Стек asynkor **не трогается**: retker — отдельный
docker-compose проект `retker` в `/opt/retker`, своя сеть, без захвата 80/443.

## Домены

| Хост | Назначение |
|------|------------|
| **retker.kz** | Основной: лендинг + дашборд (`/app`) + API (`/v1`) — всё на одном origin |
| **www.retker.kz** | 301-редирект на `retker.kz` |
| **api.retker.kz** | *(опц.)* чистый хост для приёма логов клиентами: `POST https://api.retker.kz/v1/events/*`. Тот же backend |

Фронт собирается с `VITE_API_BASE=https://retker.kz` → API/SSE/WebSocket идут на тот же
домен (без CORS). `api.retker.kz` — необязателен; если нужен, добавь его в `server_name`
блока asynkor-vhost.

## Архитектура co-host

```
Интернет → :443 asynkor-nginx ──(retker.kz)──► retker-nginx :80 ──► retker-api :8000
                  └─(asynkor.com и пр. — как было, не трогаем)
```

- `retker-api` — FastAPI, только внутренняя сеть `retker`, с выходом в интернет (LLM).
- `retker-nginx` — отдаёт SPA + проксирует `/v1`, делает **рейт-лимит на LLM**. Висит в
  сети `coframe_internal`, чтобы `asynkor-nginx` достучался к нему по имени. Наружу портов
  **не публикует** (путь A).

## Рейт-лимит (мягкий, только на модели)

В `nginx/retker.conf`:
- **LLM-эндпоинты** `/v1/chat` и `/v1/chat/ws` → `30 запросов/мин на IP`, всплеск до 15
  (`limit_req zone=llm`). Защита от слива квоты Gemini/OpenAI, но не мешает человеку.
- **Приём логов** `/v1/events/*` и весь остальной API → **без лимита** (логи идут свободно).
- Реальный IP клиента восстанавливается из `X-Forwarded-For` (`real_ip`) — для корректных
  логов и лимитов, и пишется в `/var/log/nginx/retker.access.log`.

> WebSocket-чат лимитируется на уровне *установки соединения*. Пер-сообщение по WS
> ограничивать нужно в приложении (зона brain-агента) — это отдельно.

## Маршрутизация retker.kz: два пути

### Путь A — через nginx asynkor'а (рекомендуется сейчас)
Один раз добавить server-блок из `deploy/asynkor-vhost.conf` в `/opt/coframe/nginx/nginx.conf`
(внутри `http{}`), затем:
```bash
cp /opt/coframe/nginx/nginx.conf /opt/coframe/nginx/nginx.conf.bak.$(date +%F)
# ... вставить блоки из deploy/asynkor-vhost.conf ...
docker exec asynkor-nginx nginx -t          # syntax ok / test successful
docker exec asynkor-nginx nginx -s reload   # без даунтайма
```
TLS-сертификат retker.kz (после того как DNS указывает на VM):
```bash
cd /opt/coframe
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d retker.kz -d www.retker.kz --email admin@retker.kz --agree-tos --no-eff-email -n
docker exec asynkor-nginx nginx -s reload
```
⚠️ Деплой asynkor перезаписывает его `nginx.conf` целиком → блок retker сотрётся.
Для постоянства добавь блок в **репозиторий asynkor**.

### Путь B — Cloudflare, без касания asynkor вообще
1. `retker.kz` завести в Cloudflare (оранжевое облако).
2. В `docker-compose.prod.yml` раскомментировать `ports: ["8080:80"]` у nginx, убрать
   `coframe_internal`.
3. Открыть порт `8080` в Hetzner-фаерволе (лучше только для IP Cloudflare).
4. Cloudflare: SSL-режим Full, origin → `167.233.124.48:8080` (CF поддерживает этот порт).
   asynkor не затрагивается ни на байт.

## Подготовка сервера (один раз)
```bash
mkdir -p /opt/retker
# сеть coframe_internal уже существует (создана asynkor) — отдельно создавать не нужно
```

## GitHub Secrets (через gh)
После создания репозитория retker на GitHub:
```bash
gh secret set SSH_HOST        --body "167.233.124.48"
gh secret set SSH_USERNAME    --body "root"
gh secret set SSH_PRIVATE_KEY < ~/.ssh/retker_deploy   # приватный ключ деплоя
gh secret set DOTENV          < backend/.env           # реальный .env (RETKER_SECRET + LLM-ключи)
```
(не забудь добавить публичный `~/.ssh/retker_deploy.pub` в `authorized_keys` root'а на сервере)

## Деплой
- Триггер: push в ветку **`prod`** (или вручную через Actions → Deploy retker → Run).
- CI собирает образ api + статику фронта, заливает в `/opt/retker`, поднимает **только**
  проект `retker` (`docker compose -p retker up -d`). asynkor не трогается.

## Откат
```bash
cd /opt/retker && docker compose -p retker down   # снять retker
# nginx asynkor'а: вернуть бэкап nginx.conf.bak.* и reload
```

## Файлы
- `backend/Dockerfile` — образ api (контекст = корень репо, тянет backend/ + ml/)
- `docker-compose.prod.yml` — стек retker (co-host)
- `nginx/retker.conf` — конфиг retker-nginx (SPA + /v1 + рейт-лимит LLM)
- `deploy/asynkor-vhost.conf` — блок для nginx asynkor'а (путь A)
- `.github/workflows/deploy.yml` — CI деплой (push в `prod`)
- `.github/workflows/ci.yml` — сборка/смоук на PR
- `backend/.env.example` — шаблон переменных
