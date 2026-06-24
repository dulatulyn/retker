from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

CSV = "data/raw/creditcardfraud/creditcard.csv"

print("Загружаю данные…")
df = pd.read_csv(CSV)
X = df.drop(columns=["Class"]).astype("float32")
y = df["Class"].astype(int)
print(f"  строк: {len(df):,}  фрода: {int(y.sum())} ({y.mean()*100:.3f}%)")

Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.25, stratify=y, random_state=42
)

print("Обучаю HistGradientBoosting…")
clf = HistGradientBoostingClassifier(
    max_iter=600,
    learning_rate=0.05,
    max_leaf_nodes=63,
    l2_regularization=1.0,
    random_state=42,
)
t0 = time.time()
clf.fit(Xtr, ytr)
train_s = time.time() - t0
print(f"  обучено за {train_s:.1f} c")

proba = clf.predict_proba(Xte)[:, 1]
roc = roc_auc_score(yte, proba)
pr_auc = average_precision_score(yte, proba)
pred = (proba >= 0.5).astype(int)
prec = precision_score(yte, pred)
rec = recall_score(yte, pred)
tn, fp, fn, tp = confusion_matrix(yte, pred).ravel()

print("\nСчитаю важности признаков (permutation, на сэмпле)…")
idx = np.random.RandomState(0).choice(len(Xte), size=min(20000, len(Xte)), replace=False)
perm = permutation_importance(
    clf, Xte.iloc[idx], yte.iloc[idx],
    n_repeats=5, random_state=0, scoring="average_precision", n_jobs=-1,
)
top = sorted(zip(X.columns, perm.importances_mean), key=lambda x: -x[1])[:8]

metrics = {
    "dataset": "creditcardfraud",
    "rows": len(df),
    "fraud": int(y.sum()),
    "roc_auc": round(float(roc), 4),
    "pr_auc": round(float(pr_auc), 4),
    "precision@0.5": round(float(prec), 4),
    "recall@0.5": round(float(rec), 4),
    "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    "train_seconds": round(train_s, 1),
    "top_features": [{"feature": f, "importance": round(float(v), 5)} for f, v in top],
}
json.dump(metrics, open("ml/fraud_metrics.json", "w"), ensure_ascii=False, indent=2)
dump(clf, "ml/fraud_model.joblib")

print("\n" + "=" * 52)
print("РЕЗУЛЬТАТ (для слайда):")
print(f"  ROC-AUC      : {roc:.4f}")
print(f"  PR-AUC       : {pr_auc:.4f}")
print(f"  Precision@.5 : {prec:.3f}   Recall@.5 : {rec:.3f}")
print(f"  Поймано фрода: {tp}/{tp+fn}   ложных: {fp}")
print(f"  Время обуч.  : {train_s:.1f} c (локально, без GPU)")
print(f"  Топ-признаки : {', '.join(f for f,_ in top[:6])}")
print("=" * 52)
print("сохранено: ml/fraud_model.joblib, ml/fraud_metrics.json")
