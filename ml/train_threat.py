from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

import numpy as np
from joblib import dump
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import average_precision_score, confusion_matrix, roc_auc_score

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT / "backend"))

from app.ai import features as F

PAYSIM = _ROOT / "data/raw/paysim/PS_20174392719_1491204439457_log.csv"
PHISHING = _ROOT / "data/raw/phishing/phishing_site_urls.csv"
NSL = _ROOT / "data/raw/nslkdd/KDDTrain+.txt"

PAYSIM_BENIGN_STRIDE = 30
PHISH_GOOD_STRIDE = 4
TEST_STRIDE = 5

csv.field_size_limit(10_000_000)


def _emit(X, y, ec, src, row, label, klass):
    X.append(row)
    y.append(label)
    ec.append(klass)
    src.append(klass)


def load_paysim(X, y, ec, src):
    if not PAYSIM.exists():
        return 0
    n = 0
    with open(PAYSIM, encoding="utf-8") as f:
        r = csv.reader(f)
        next(r, None)
        benign = 0
        for parts in r:
            if len(parts) < 11:
                continue
            is_fraud = parts[9] == "1"
            if not is_fraud:
                benign += 1
                if benign % PAYSIM_BENIGN_STRIDE:
                    continue
            feats = F.tx_features(parts[2], parts[1], parts[4], parts[5], parts[7], parts[8])
            _emit(X, y, ec, src, F.to_row(feats, "transaction"), 1 if is_fraud else 0, "transaction")
            n += 1
    return n


def load_phishing(X, y, ec, src):
    if not PHISHING.exists():
        return 0
    n = 0
    good = 0
    with open(PHISHING, encoding="utf-8", errors="ignore") as f:
        first = True
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            url, _, label = line.rpartition(",")
            label = label.strip().lower()
            if first:
                first = False
                if label == "label":
                    continue
            if label not in ("good", "bad"):
                continue
            if label == "good":
                good += 1
                if good % PHISH_GOOD_STRIDE:
                    continue
            feats = F.url_features(url)
            _emit(X, y, ec, src, F.to_row(feats, "web"), 1 if label == "bad" else 0, "web")
            n += 1
    return n


def load_nsl(X, y, ec, src):
    if not NSL.exists():
        return 0
    n = 0
    with open(NSL, encoding="utf-8") as f:
        r = csv.reader(f)
        for parts in r:
            if len(parts) < 42:
                continue
            d = dict(zip(F.NSL_COLUMNS, parts))
            mal = 1 if d.get("label", "normal") != "normal" else 0
            feats = F.nsl_features(d)
            _emit(X, y, ec, src, F.to_row(feats, "access"), mal, "access")
            n += 1
    return n


def main():
    t0 = time.time()
    X, y, ec, src = [], [], [], []
    print("loading paysim ...", flush=True)
    print("  transaction rows:", load_paysim(X, y, ec, src), flush=True)
    print("loading nslkdd ...", flush=True)
    print("  access rows:", load_nsl(X, y, ec, src), flush=True)
    print("loading phishing ...", flush=True)
    print("  web rows:", load_phishing(X, y, ec, src), flush=True)

    Xa = np.asarray(X, dtype=np.float32)
    ya = np.asarray(y, dtype=np.int8)
    eca = np.asarray(ec)
    idx = np.arange(len(ya))
    test_mask = (idx % TEST_STRIDE == 0)
    train_mask = ~test_mask

    pos = int(ya[train_mask].sum())
    neg = int((ya[train_mask] == 0).sum())
    w_pos = len(ya[train_mask]) / (2.0 * pos) if pos else 1.0
    w_neg = len(ya[train_mask]) / (2.0 * neg) if neg else 1.0
    sw = np.where(ya[train_mask] == 1, w_pos, w_neg).astype(np.float32)

    print(f"train={int(train_mask.sum())} test={int(test_mask.sum())} pos_total={int(ya.sum())}", flush=True)

    clf = HistGradientBoostingClassifier(
        max_iter=350,
        learning_rate=0.08,
        max_leaf_nodes=63,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
    )
    print("training ...", flush=True)
    clf.fit(Xa[train_mask], ya[train_mask], sample_weight=sw)

    proba = clf.predict_proba(Xa[test_mask])[:, 1]
    yt = ya[test_mask]
    ect = eca[test_mask]

    def block(mask):
        yy = yt[mask]
        pp = proba[mask]
        if len(yy) == 0 or yy.min() == yy.max():
            return {"n": int(len(yy)), "roc_auc": None, "pr_auc": None}
        pred = (pp >= 0.5).astype(int)
        tn, fp, fn, tp = confusion_matrix(yy, pred, labels=[0, 1]).ravel()
        return {
            "n": int(len(yy)),
            "positives": int(yy.sum()),
            "roc_auc": round(float(roc_auc_score(yy, pp)), 4),
            "pr_auc": round(float(average_precision_score(yy, pp)), 4),
            "precision@0.5": round(tp / (tp + fp), 4) if (tp + fp) else None,
            "recall@0.5": round(tp / (tp + fn), 4) if (tp + fn) else None,
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        }

    metrics = {
        "model": "unified_threat",
        "algo": "HistGradientBoostingClassifier",
        "datasets": ["paysim", "nslkdd", "phishing"],
        "vectors": ["transaction", "access", "web"],
        "train_rows": int(train_mask.sum()),
        "test_rows": int(test_mask.sum()),
        "feature_order": F.UNIFIED_FEATURES,
        "overall": block(np.ones(len(yt), dtype=bool)),
        "by_vector": {
            "transaction": block(ect == "transaction"),
            "access": block(ect == "access"),
            "web": block(ect == "web"),
        },
    }

    print("permutation importance ...", flush=True)
    sub = np.where(test_mask)[0]
    sub = sub[:: max(1, len(sub) // 4000)]
    try:
        pi = permutation_importance(clf, Xa[sub], ya[sub], n_repeats=3, random_state=42, scoring="roc_auc")
        order = np.argsort(pi.importances_mean)[::-1][:15]
        metrics["top_features"] = [
            {"feature": F.UNIFIED_FEATURES[i], "importance": round(float(pi.importances_mean[i]), 5)}
            for i in order if pi.importances_mean[i] > 0
        ]
    except Exception as e:
        metrics["top_features"] = []
        metrics["importance_error"] = str(e)

    metrics["train_seconds"] = round(time.time() - t0, 1)

    dump(clf, _ROOT / "ml/threat_model.joblib")
    (_ROOT / "ml/threat_metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
