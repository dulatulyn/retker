"""
Build: CSV -> нормализатор -> валидация pydantic -> JSONL в data/normalized/.

Использование:
  python data/build.py --samples                 # прогнать все мини-сэмплы (тест пайплайна)
  python data/build.py creditcard data/raw/creditcard.csv 100000
                                                 # реальный датасет (опц. лимит строк)

Один и тот же код работает и на сэмплах, и на полных датасетах с Kaggle.
"""
from __future__ import annotations

import json
import sys
from collections import Counter

import pandas as pd

from normalizers import REGISTRY

# имя -> (путь сэмпла, доп.kwargs нормализатора)
SAMPLES = {
    "creditcardfraud": ("data/samples/creditcard.csv", {}),
    "paysim":          ("data/samples/paysim.csv", {}),
    "cicids2017":      ("data/samples/cicids2017.csv", {}),
    "nslkdd":          ("data/samples/nslkdd.csv", {}),
    "phishing":        ("data/samples/phishing.csv", {}),
    "cert_logon":      ("data/samples/cert_logon.csv", {"insider_users": {"MAL9"}}),
}


def build_one(name: str, path: str, nrows: int | None = None, **kwargs) -> list:
    read_kwargs = {"nrows": nrows} if nrows else {}
    # NSL-KDD сэмпл/датасет без заголовка
    if name == "nslkdd":
        read_kwargs["header"] = None
    df = pd.read_csv(path, **read_kwargs)
    events = REGISTRY[name](df, **kwargs)
    out_path = f"data/normalized/{name}.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for e in events:
            f.write(e.model_dump_json() + "\n")
    cats = Counter(e.label.category.value for e in events)
    mal = sum(1 for e in events if e.label.is_malicious)
    print(f"  {name:16s} rows={len(events):>4}  malicious={mal:>3}  "
          f"cats={dict(cats)}  -> {out_path}")
    return events


def main():
    args = sys.argv[1:]
    if not args or args[0] == "--samples":
        print("Нормализую мини-сэмплы (тест пайплайна форматов):")
        first = None
        for name, (path, kw) in SAMPLES.items():
            ev = build_one(name, path, **kw)
            if first is None and ev:
                first = ev[0]
        if first is not None:
            print("\nПример CanonicalEvent (1-я запись creditcardfraud):")
            print(json.dumps(json.loads(first.model_dump_json()), ensure_ascii=False, indent=2))
        return
    name = args[0]
    path = args[1]
    nrows = int(args[2]) if len(args) > 2 else None
    kw = {"insider_users": {"MAL9"}} if name == "cert_logon" else {}
    print(f"Нормализую {name} из {path} (nrows={nrows}):")
    build_one(name, path, nrows=nrows, **kw)


if __name__ == "__main__":
    main()
