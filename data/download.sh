#!/usr/bin/env bash
# Качаем датасеты с Kaggle в data/raw/. Нужен токен ~/.kaggle/kaggle.json.
# Получить токен: kaggle.com -> Settings -> API -> Create New Token (скачает kaggle.json)
# Затем:  mkdir -p ~/.kaggle && mv ~/Downloads/kaggle.json ~/.kaggle/ && chmod 600 ~/.kaggle/kaggle.json
set -euo pipefail

KAGGLE="$HOME/Library/Python/3.9/bin/kaggle"
[ -x "$KAGGLE" ] || KAGGLE="kaggle"
RAW="data/raw"
mkdir -p "$RAW"

dl () {  # dl <slug> <subdir>
  echo ">>> $1"
  "$KAGGLE" datasets download -d "$1" -p "$RAW/$2" --unzip
}

# --- подтверждённые слаги ---
dl mlg-ulb/creditcardfraud            creditcardfraud   # финансовый фрод (классика)
dl ealaxi/paysim1                     paysim            # мобильные деньги, отмывание/вывод
dl chethuhn/network-intrusion-dataset cicids2017        # CIC-IDS2017: вторжения/брутфорс
dl hassan06/nslkdd                    nslkdd            # NSL-KDD: классич. IDS

# --- найти точные слаги под наш кейс (раскомментируй после просмотра вывода) ---
echo ">>> поиск фишинг-датасетов:"; "$KAGGLE" datasets list -s "phishing url" | head -8
echo ">>> поиск insider/UEBA:";     "$KAGGLE" datasets list -s "insider threat" | head -8
# Примеры (проверь актуальность слага перед dl):
# dl shashwatwork/web-page-phishing-detection-dataset  phishing
# dl <owner>/<insider-threat-slug>                     cert_insider

echo "DONE. Дальше:  python3 data/build.py creditcardfraud data/raw/creditcardfraud/creditcard.csv"
