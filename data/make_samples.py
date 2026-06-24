"""
Генерим мини-сэмплы С НАСТОЯЩЕЙ структурой колонок каждого датасета (5-8 строк,
в каждом подсажена 1 «злая» запись). Это позволяет протестировать нормализаторы
СЕЙЧАС, до скачивания полных датасетов с Kaggle. Когда зальёшь токен и скачаешь
реальные CSV — те же нормализаторы прожуют их без изменений.

Сэмплы — не для обучения, только для проверки пайплайна форматов.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
OUT = "data/samples"


def creditcard():
    n = 6
    df = pd.DataFrame({"Time": np.arange(n) * 3600.0})
    for k in range(1, 29):
        df[f"V{k}"] = rng.normal(0, 1, n).round(4)
    df["Amount"] = rng.uniform(5, 500, n).round(2)
    df["Class"] = [0, 0, 0, 1, 0, 0]              # одна фрод-транзакция
    df.loc[3, "Amount"] = 4999.0
    df.to_csv(f"{OUT}/creditcard.csv", index=False)


def paysim():
    df = pd.DataFrame({
        "step": [1, 1, 2, 2, 3],
        "type": ["PAYMENT", "TRANSFER", "CASH_OUT", "TRANSFER", "CASH_IN"],
        "amount": [1200.0, 50000.0, 50000.0, 9000.0, 300.0],
        "nameOrig": ["C111", "C222", "C222", "C333", "C444"],
        "oldbalanceOrg": [2000.0, 50000.0, 0.0, 9000.0, 0.0],
        "newbalanceOrig": [800.0, 0.0, 0.0, 0.0, 300.0],
        "nameDest": ["M1", "C999", "C999", "C888", "M2"],
        "oldbalanceDest": [0.0, 0.0, 0.0, 0.0, 0.0],
        "newbalanceDest": [0.0, 50000.0, 0.0, 9000.0, 0.0],
        "isFraud": [0, 1, 1, 0, 0],               # классич. TRANSFER+CASH_OUT вывод
        "isFlaggedFraud": [0, 0, 0, 0, 0],
    })
    df.to_csv(f"{OUT}/paysim.csv", index=False)


def cicids():
    # подмножество из 78 признаков + Label (реальные имена с пробелами/слэшами)
    df = pd.DataFrame({
        "Destination Port": [80, 443, 22, 80, 53],
        "Flow Duration": [120, 95, 5000000, 80, 60],
        "Total Fwd Packets": [10, 12, 2, 9, 4],
        "Total Backward Packets": [8, 10, 0, 7, 3],
        "Flow Bytes/s": [1500.0, 2000.0, np.inf, 1400.0, 900.0],  # inf специально
        "Flow Packets/s": [50.0, 60.0, 0.4, 48.0, 30.0],
        "Label": ["BENIGN", "BENIGN", "SSH-Patator", "BENIGN", "BENIGN"],
    })
    df.to_csv(f"{OUT}/cicids2017.csv", index=False)


def nslkdd():
    # NSL-KDD идёт без заголовка -> 43 поля (41 признак + label + difficulty)
    rows = []
    for i in range(5):
        feats = [0, "tcp", "http", "SF", 215, 45076] + list(rng.integers(0, 3, 35))
        label = "neptune" if i == 2 else "normal"   # neptune = DoS-атака
        rows.append(feats + [label, 20])
    pd.DataFrame(rows).to_csv(f"{OUT}/nslkdd.csv", index=False, header=False)


def phishing():
    df = pd.DataFrame({
        "url": ["paypal.com", "kaspi-bonus.xn--80a.tk", "google.com",
                "halyk-bank.verify-login.ru", "wikipedia.org"],
        "url_length": [11, 23, 10, 27, 13],
        "has_at_symbol": [0, 1, 0, 1, 0],
        "domain_age_days": [9000, 3, 9999, 12, 8000],
        "status": ["legitimate", "phishing", "legitimate", "phishing", "legitimate"],
    })
    df.to_csv(f"{OUT}/phishing.csv", index=False)


def cert_logon():
    df = pd.DataFrame({
        "id": [f"{{L{i}}}" for i in range(6)],
        "date": ["06/01/2026 08:12:00", "06/01/2026 08:30:00", "06/01/2026 02:47:00",
                 "06/01/2026 09:01:00", "06/01/2026 03:05:00", "06/01/2026 18:20:00"],
        "user": ["AAB1", "ACD2", "MAL9", "AAB1", "MAL9", "ACD2"],
        "pc": ["PC-101", "PC-102", "PC-777", "PC-101", "PC-777", "PC-102"],
        "activity": ["Logon", "Logon", "Logon", "Logoff", "Logoff", "Logon"],
    })
    df.to_csv(f"{OUT}/cert_logon.csv", index=False)


if __name__ == "__main__":
    creditcard(); paysim(); cicids(); nslkdd(); phishing(); cert_logon()
    print("samples written to", OUT)
