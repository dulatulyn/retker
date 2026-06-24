"""
Нормализаторы: датасет (pandas.DataFrame) -> list[CanonicalEvent].

Каждый источник имеет свою «физику» колонок — здесь живёт всё знание про маппинг.
Добавить новый датасет = добавить одну функцию + запись в REGISTRY. Ядро не трогаем.

Колонки взяты из реальных схем датасетов (см. data/DATASETS.md). Нормализаторы
устойчивы к отсутствию колонок и к мусору (CIC-IDS2017, например, имеет пробелы
в именах колонок и значения inf/NaN).
"""
from __future__ import annotations

import math
from typing import Any, Iterable

import pandas as pd

from canonical import (
    Actor, CanonicalEvent, EventClass, Label, Provenance, Target,
    ThreatCategory, synth_ts,
)


# ---------- утилиты ----------

def _num(v: Any) -> float | None:
    """Безопасно в float; inf/NaN -> None."""
    try:
        f = float(v)
        if math.isinf(f) or math.isnan(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _clean_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _numeric_metrics(row: dict, skip: set[str]) -> dict[str, float]:
    out = {}
    for k, v in row.items():
        if k in skip:
            continue
        f = _num(v)
        if f is not None:
            out[k] = f
    return out


# ---------- транзакции: Credit Card Fraud (mlg-ulb/creditcardfraud) ----------
# Колонки: Time, V1..V28, Amount, Class (1=fraud)
def norm_creditcard(df: pd.DataFrame) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        cls = int(r.get("Class", 0) or 0)
        out.append(CanonicalEvent(
            event_id=f"ccf-{i}",
            ts=synth_ts(seconds=_num(r.get("Time")) or 0.0),
            event_class=EventClass.transaction,
            action="card_payment",
            metrics={k: v for k, v in {
                "amount": _num(r.get("Amount")),
                **{f"pca_{n}": _num(r.get(f"V{n}")) for n in range(1, 29)},
            }.items() if v is not None},
            label=Label(is_malicious=bool(cls),
                        category=ThreatCategory.fraud if cls else ThreatCategory.benign,
                        original=str(cls)),
            provenance=Provenance(dataset="creditcardfraud", source_row=int(i)),
            raw=r,
        ))
    return out


# ---------- транзакции: PaySim (ealaxi/paysim1) ----------
# step,type,amount,nameOrig,oldbalanceOrg,newbalanceOrig,nameDest,
# oldbalanceDest,newbalanceDest,isFraud,isFlaggedFraud
def norm_paysim(df: pd.DataFrame) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        fraud = int(r.get("isFraud", 0) or 0)
        out.append(CanonicalEvent(
            event_id=f"paysim-{i}",
            ts=synth_ts(hours=_num(r.get("step")) or 0.0),
            event_class=EventClass.transaction,
            action=str(r.get("type", "")).lower() or None,
            actor=Actor(account=str(r.get("nameOrig")) if r.get("nameOrig") else None),
            target=Target(account=str(r.get("nameDest")) if r.get("nameDest") else None),
            metrics={k: v for k, v in {
                "amount": _num(r.get("amount")),
                "old_balance_orig": _num(r.get("oldbalanceOrg")),
                "new_balance_orig": _num(r.get("newbalanceOrig")),
                "old_balance_dest": _num(r.get("oldbalanceDest")),
                "new_balance_dest": _num(r.get("newbalanceDest")),
            }.items() if v is not None},
            attributes={"flagged": bool(int(r.get("isFlaggedFraud", 0) or 0))},
            label=Label(is_malicious=bool(fraud),
                        category=ThreatCategory.fraud if fraud else ThreatCategory.benign,
                        original=str(fraud)),
            provenance=Provenance(dataset="paysim", source_row=int(i)),
            raw=r,
        ))
    return out


# ---------- сетевые потоки: CIC-IDS2017 ----------
_CIC_MAP = {
    "ddos": ThreatCategory.dos, "dos": ThreatCategory.dos,
    "portscan": ThreatCategory.port_scan, "bot": ThreatCategory.botnet,
    "patator": ThreatCategory.brute_force, "brute": ThreatCategory.brute_force,
    "web attack": ThreatCategory.web_attack, "sql": ThreatCategory.web_attack,
    "xss": ThreatCategory.web_attack, "infiltration": ThreatCategory.infiltration,
    "heartbleed": ThreatCategory.intrusion,
}
def _cic_category(label: str) -> tuple[bool, ThreatCategory]:
    l = label.strip().lower()
    if l in ("benign", "normal", ""):
        return False, ThreatCategory.benign
    for key, cat in _CIC_MAP.items():
        if key in l:
            return True, cat
    return True, ThreatCategory.intrusion


def norm_cicids(df: pd.DataFrame) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        raw_label = str(r.get("Label", "BENIGN"))
        mal, cat = _cic_category(raw_label)
        ts_off = _num(r.get("Flow Duration"))  # нет реального ts -> разносим по строке
        out.append(CanonicalEvent(
            event_id=f"cic-{i}",
            ts=synth_ts(seconds=float(i)),
            event_class=EventClass.network_flow,
            action="network_flow",
            target=Target(port=int(_num(r.get("Destination Port")) or 0) or None),
            metrics=_numeric_metrics(r, skip={"Label"}),
            label=Label(is_malicious=mal, category=cat, original=raw_label),
            provenance=Provenance(dataset="cicids2017", source_row=int(i)),
            raw=r,
        ))
    return out


# ---------- сетевые потоки: NSL-KDD (hassan06/nslkdd) ----------
# 41 признак + class (normal/anomaly) [+ difficulty]
_NSLKDD_COLS = [
    "duration","protocol_type","service","flag","src_bytes","dst_bytes","land",
    "wrong_fragment","urgent","hot","num_failed_logins","logged_in","num_compromised",
    "root_shell","su_attempted","num_root","num_file_creations","num_shells",
    "num_access_files","num_outbound_cmds","is_host_login","is_guest_login","count",
    "srv_count","serror_rate","srv_serror_rate","rerror_rate","srv_rerror_rate",
    "same_srv_rate","diff_srv_rate","srv_diff_host_rate","dst_host_count",
    "dst_host_srv_count","dst_host_same_srv_rate","dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate","dst_host_srv_diff_host_rate","dst_host_serror_rate",
    "dst_host_srv_serror_rate","dst_host_rerror_rate","dst_host_srv_rerror_rate",
    "label","difficulty",
]
def norm_nslkdd(df: pd.DataFrame) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    # NSL-KDD часто без заголовка — проставим, если колонки безымянные/числовые
    if list(df.columns)[:3] != ["duration", "protocol_type", "service"]:
        n = len(df.columns)
        df.columns = _NSLKDD_COLS[:n]
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        raw_label = str(r.get("label", "normal"))
        mal = raw_label.strip().lower() not in ("normal", "")
        out.append(CanonicalEvent(
            event_id=f"nslkdd-{i}",
            ts=synth_ts(seconds=float(i)),
            event_class=EventClass.network_flow,
            action="network_connection",
            attributes={"protocol": r.get("protocol_type"), "service": r.get("service"),
                        "flag": r.get("flag")},
            metrics=_numeric_metrics(r, skip={"label", "difficulty", "protocol_type",
                                              "service", "flag"}),
            label=Label(is_malicious=mal,
                        category=ThreatCategory.intrusion if mal else ThreatCategory.benign,
                        original=raw_label),
            provenance=Provenance(dataset="nslkdd", source_row=int(i)),
            raw=r,
        ))
    return out


# ---------- фишинг: URL/website features ----------
# Схемы варьируются; обрабатываем generic: ищем колонку url и колонку label/status/Result
def norm_phishing(df: pd.DataFrame) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    cols = {c.lower(): c for c in df.columns}
    url_col = next((cols[c] for c in ("url", "domain", "website") if c in cols), None)
    label_col = next((cols[c] for c in ("label", "status", "result", "class", "type")
                      if c in cols), None)
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        raw_label = str(r.get(label_col)) if label_col else ""
        l = raw_label.strip().lower()
        mal = l in ("1", "-1", "phishing", "phish", "bad", "malicious", "yes", "true")
        out.append(CanonicalEvent(
            event_id=f"phish-{i}",
            ts=synth_ts(seconds=float(i)),
            event_class=EventClass.web,
            action="url_visit",
            target=Target(url=str(r.get(url_col)) if url_col else None),
            metrics=_numeric_metrics(r, skip={label_col} if label_col else set()),
            label=Label(is_malicious=mal,
                        category=ThreatCategory.phishing if mal else ThreatCategory.benign,
                        original=raw_label),
            provenance=Provenance(dataset="phishing", source_row=int(i)),
            raw=r,
        ))
    return out


# ---------- инсайдер: CERT logon.csv ----------
# id,date,user,pc,activity (Logon/Logoff)
def norm_cert_logon(df: pd.DataFrame, insider_users: set[str] | None = None) -> list[CanonicalEvent]:
    df = _clean_cols(df)
    insider_users = insider_users or set()
    out: list[CanonicalEvent] = []
    for i, row in df.iterrows():
        r = row.to_dict()
        user = str(r.get("user", "")) or None
        mal = user in insider_users
        out.append(CanonicalEvent(
            event_id=f"cert-{r.get('id', i)}",
            ts=pd.to_datetime(r.get("date"), errors="coerce", utc=True).to_pydatetime()
               if r.get("date") else synth_ts(seconds=float(i)),
            event_class=EventClass.user_activity,
            action=str(r.get("activity", "")).lower() or None,
            actor=Actor(user=user, device=str(r.get("pc")) if r.get("pc") else None),
            label=Label(is_malicious=mal,
                        category=ThreatCategory.insider if mal else ThreatCategory.benign,
                        original=("insider" if mal else "normal")),
            provenance=Provenance(dataset="cert_insider", source_row=int(i)),
            raw=r,
        ))
    return out


# Реестр: имя датасета -> нормализатор
REGISTRY = {
    "creditcardfraud": norm_creditcard,
    "paysim": norm_paysim,
    "cicids2017": norm_cicids,
    "nslkdd": norm_nslkdd,
    "phishing": norm_phishing,
    "cert_logon": norm_cert_logon,
}
