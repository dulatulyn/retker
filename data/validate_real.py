"""
Валидация нормализаторов на РЕАЛЬНЫХ датасетах (не сэмплах).
Читает полный файл, печатает истинное распределение меток, затем нормализует
случайную выборку и сверяет, что наша гармонизация меток совпадает с реальностью.
"""
from __future__ import annotations

from collections import Counter

import pandas as pd

from normalizers import (
    norm_cicids, norm_creditcard, norm_nslkdd, norm_paysim, norm_phishing,
)

R = "data/raw"
SAMPLE = 20000

JOBS = [
    ("creditcardfraud", f"{R}/creditcardfraud/creditcard.csv", norm_creditcard, {}, "Class"),
    ("paysim", f"{R}/paysim/PS_20174392719_1491204439457_log.csv", norm_paysim, {}, "isFraud"),
    ("cicids2017", f"{R}/cicids2017/Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
     norm_cicids, {}, " Label"),
    ("nslkdd", f"{R}/nslkdd/KDDTrain+.txt", norm_nslkdd, {"header": None}, None),
    ("phishing", f"{R}/phishing/phishing_site_urls.csv", norm_phishing, {}, "Label"),
]

for name, path, fn, rk, lcol in JOBS:
    full = pd.read_csv(path, **rk)
    if lcol and lcol in full.columns:
        truth = full[lcol].value_counts().to_dict()
    elif name == "nslkdd":
        truth = full.iloc[:, -2].value_counts().head(6).to_dict()
    else:
        truth = {}
    samp = full.sample(min(SAMPLE, len(full)), random_state=0)
    ev = fn(samp)
    mal = sum(1 for e in ev if e.label.is_malicious)
    cats = Counter(e.label.category.value for e in ev)
    print(f"\n=== {name} ===  всего строк: {len(full):,}")
    print(f"  истинные метки (топ): {dict(list(truth.items())[:6])}")
    print(f"  нормализовано: sample={len(ev)}  malicious={mal}  -> {dict(cats)}")
    m = next((e for e in ev if e.label.is_malicious), None)
    if m:
        print(f"  пример угрозы: class={m.event_class.value} cat={m.label.category.value} "
              f"action={m.action} metrics={list(m.metrics)[:5]}")
