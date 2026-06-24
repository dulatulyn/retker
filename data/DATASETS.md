# Датасеты — манифест

Все приводятся к единому формату `CanonicalEvent` (см. `canonical.py`).
Скачивание: `bash data/download.sh` (нужен Kaggle токen). Нормализация: `python3 data/build.py <name> <csv>`.

| # | Датасет | Slug (Kaggle) | Угроза трека | Тип события | Размер | Метка |
|---|---------|---------------|--------------|-------------|--------|-------|
| 1 | Credit Card Fraud (ULB) | `mlg-ulb/creditcardfraud` | утечки/финфрод | transaction | ~150MB, 284k | `Class` 0/1 |
| 2 | PaySim | `ealaxi/paysim1` | финфрод/отмывание | transaction | ~470MB, 6.3M | `isFraud` |
| 3 | CIC-IDS2017 | `chethuhn/network-intrusion-dataset` | несанкц. доступ | network_flow | ~1GB, 2.8M | `Label` (multi) |
| 4 | NSL-KDD | `hassan06/nslkdd` | несанкц. доступ | network_flow | ~5MB, 125k | normal/attack |
| 5 | Phishing URL/website | *(найти: `kaggle datasets list -s "phishing url"`)* | фишинг | web | small | phishing/legit |
| 6 | CERT Insider Threat (CMU) | *(найти: `-s "insider threat"`)* | аномалии/инсайдер | user_activity | большой | сценарий |

## Почему именно эти
- **АФМ = финразведка** → фрод-датасеты (1,2) самые «в тему» по мандату (ПОД/ФТ).
- **CIC-IDS2017 / NSL-KDD** (3,4) закрывают «несанкц. доступ» (brute force, port scan, DoS).
- **Phishing** (5) — отдельная угроза трека, самый простой честный классификатор.
- **CERT** (6) — единственный с настоящей историей инсайдера (логоны/файлы/почта) → наша
  демо-история «офицер качает данные ночью».

## Что уже работает (без полных датасетов)
`data/samples/*.csv` — мини-сэмплы с настоящей структурой колонок. `python3 data/build.py --samples`
прогоняет их через нормализаторы → `data/normalized/*.jsonl`. Когда скачаешь реальные CSV —
**тот же код** их прожуёт (нормализаторы устойчивы к размеру, inf/NaN, безымянным колонкам).

## Статус
- [x] Kaggle CLI установлен (`~/Library/Python/3.9/bin/kaggle`)
- [ ] Токен `~/.kaggle/kaggle.json` — **нужен от тебя** (см. `download.sh`)
- [ ] Скачать датасеты 1–4
- [ ] Найти слаги 5–6
