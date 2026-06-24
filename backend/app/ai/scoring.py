from __future__ import annotations

import math

from . import features, model
from .settings import ML_DIR


class Scorer:
    name = "base"
    artifact = ""
    event_classes: tuple = ()
    feature_spec: list[str] = []

    def path(self) -> str:
        return str(ML_DIR / self.artifact)

    def _model(self):
        return model.load_model(self.path())

    def available(self) -> bool:
        return self._model() is not None

    def expected_features(self) -> list[str] | None:
        m = self._model()
        names = getattr(m, "feature_names_in_", None)
        return list(names) if names is not None else None

    def extract(self, event, org_id: str) -> dict[str, float]:
        raise NotImplementedError

    def _row(self, feats: dict[str, float]):
        names = self.expected_features()
        if names is not None:
            return [[float(feats.get(n, 0.0)) for n in names]], names
        return [list(map(float, feats.values()))], list(feats.keys())

    def _reasons(self, feats: dict[str, float]) -> list[str]:
        return []

    def _proba(self, model_obj, row) -> float | None:
        try:
            if hasattr(model_obj, "predict_proba"):
                return float(model_obj.predict_proba(row)[0][1])
            if hasattr(model_obj, "decision_function"):
                raw = float(model_obj.decision_function(row)[0])
                return 1.0 / (1.0 + math.exp(raw * 4.0))
            if hasattr(model_obj, "score_samples"):
                raw = float(model_obj.score_samples(row)[0])
                return 1.0 / (1.0 + math.exp(raw))
        except Exception:
            return None
        return None

    def score_features(self, feats: dict[str, float]) -> dict | None:
        m = self._model()
        if m is None:
            return None
        row, used = self._row(feats)
        proba = self._proba(m, row)
        if proba is None:
            return None
        overlap = set(feats) & set(used)
        compatible = bool(overlap)
        return {
            "model": self.name,
            "score": round(proba, 4),
            "label": "alert" if proba >= 0.5 else "ok",
            "compatible": compatible,
            "reasons": self._reasons(feats),
            "features": {k: feats[k] for k in list(feats)[:12]},
            "note": "" if compatible else
                    "признаки события не совпадают с колонками обученной модели; "
                    "переобучить на читаемых признаках (см. feature_spec)",
        }

    def score_event(self, event, org_id: str) -> dict | None:
        res = self.score_features(self.extract(event, org_id))
        if res is not None:
            res["explanation_ru"] = explain_score(res)
        return res


class FraudScorer(Scorer):
    name = "fraud"
    artifact = "fraud_model.joblib"
    event_classes = ("transaction",)
    feature_spec = features.FRAUD_FEATURES

    def extract(self, event, org_id):
        return features.transaction_features(event)

    def _reasons(self, feats):
        out: list[str] = []
        if feats.get("type_transfer") and feats.get("type_cash_out"):
            out.append("перевод с последующим обналичиванием")
        elif feats.get("type_cash_out"):
            out.append("обналичивание средств")
        elif feats.get("type_transfer"):
            out.append("перевод средств")
        if feats.get("amount", 0) >= 100000:
            out.append("крупная сумма")
        if feats.get("balance_delta_org", 0) > 0 and feats.get("newbalanceOrig", 1) == 0:
            out.append("обнуление баланса отправителя")
        return out


class AnomalyScorer(Scorer):
    name = "anomaly"
    artifact = "anomaly_model.joblib"
    event_classes = ("data_activity", "access")
    feature_spec = features.ANOMALY_FEATURES

    def extract(self, event, org_id):
        return features.user_behavior_features(org_id, event)

    def _reasons(self, feats):
        out: list[str] = []
        if feats.get("rows_ratio", 0) >= 3:
            out.append(f"объём выгрузки в {feats['rows_ratio']}× выше нормы пользователя")
        if feats.get("is_night"):
            out.append("активность в ночное время")
        if feats.get("unique_resources", 0) >= 5:
            out.append("обращение к нетипично большому числу ресурсов")
        return out


class UnifiedThreatScorer(Scorer):
    name = "threat"
    artifact = "threat_model.joblib"
    event_classes = ("transaction", "access", "data_activity", "email", "web")
    feature_spec = features.UNIFIED_FEATURES

    def expected_features(self):
        return features.UNIFIED_FEATURES

    def _unified_reasons(self, feats: dict, cls: str) -> list[str]:
        out: list[str] = []
        if cls == "transaction":
            if feats.get("type_transfer") and feats.get("orig_emptied"):
                out.append("перевод с обнулением баланса отправителя")
            elif feats.get("type_cash_out"):
                out.append("обналичивание средств")
            elif feats.get("type_transfer"):
                out.append("перевод средств")
            if feats.get("amount", 0) >= 100000:
                out.append("крупная сумма")
            if abs(feats.get("error_balance_orig", 0)) > 1:
                out.append("несходимость баланса отправителя")
        elif cls in ("email", "web"):
            if feats.get("has_punycode"):
                out.append("punycode-домен (омоглиф)")
            if feats.get("has_ip"):
                out.append("IP вместо доменного имени")
            if feats.get("suspicious_tld"):
                out.append("подозрительный домен верхнего уровня")
            if feats.get("has_login_word") and feats.get("has_at"):
                out.append("маскировка под форму входа")
            if feats.get("url_length", 0) >= 75:
                out.append("аномально длинный URL")
        elif cls in ("access", "data_activity"):
            if feats.get("failed_logins", 0) >= 3:
                out.append("серия неудачных входов")
            if feats.get("login_success") == 0:
                out.append("вход не выполнен")
        return out

    def score_event(self, event, org_id: str) -> dict | None:
        m = self._model()
        if m is None:
            return None
        feats = features.unified_features(event, org_id)
        proba = self._proba(m, [features.to_row(feats, event.event_class)])
        if proba is None:
            return None
        res = {
            "model": self.name,
            "score": round(proba, 4),
            "label": "alert" if proba >= 0.5 else "ok",
            "compatible": True,
            "reasons": self._unified_reasons(feats, event.event_class),
            "features": {k: feats[k] for k in list(feats)[:12]},
        }
        res["explanation_ru"] = explain_score(res)
        return res


SCORERS: list[Scorer] = [UnifiedThreatScorer(), FraudScorer(), AnomalyScorer()]
_BY_NAME = {s.name: s for s in SCORERS}


def score_event(event, org_id: str) -> dict | None:
    for s in SCORERS:
        if event.event_class in s.event_classes and s.available():
            res = s.score_event(event, org_id)
            if res is not None:
                return res
    return None


def score_features(model_name: str, feats: dict[str, float]) -> dict | None:
    s = _BY_NAME.get(model_name)
    if s is None:
        return None
    res = s.score_features(feats)
    if res is not None:
        res["explanation_ru"] = explain_score(res)
    return res


def explain_score(res: dict) -> str:
    score = res.get("score", 0.0)
    reasons = res.get("reasons") or []
    head = f"Скор {res.get('model')} = {score}."
    if reasons:
        return head + " Причины: " + ", ".join(reasons) + "."
    return head + " Явных читаемых признаков нет (проверьте feature_spec модели)."


def status() -> list[dict]:
    out = []
    for s in SCORERS:
        out.append({
            "name": s.name,
            "available": s.available(),
            "artifact": s.artifact,
            "event_classes": list(s.event_classes),
            "feature_spec": s.feature_spec,
            "trained_features": s.expected_features(),
        })
    return out
