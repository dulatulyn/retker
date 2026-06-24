from __future__ import annotations

from .schemas import Alert, CanonicalEvent, Incident
from .store import store


def explain(a: Alert) -> str:
    ev = a.evidence
    if a.detector == "brute_force":
        return f"Зафиксировано {ev.get('fails')} неудачных входов подряд (IP {ev.get('ip')}, {ev.get('country')}) — попытка подбора пароля."
    if a.detector == "impossible_travel":
        return (f"Вход из {ev.get('from')} и {ev.get('to')} за короткое время — "
                f"≈{ev.get('kmh')} км/ч. Физически невозможно: вероятен захват аккаунта.")
    if a.detector == "new_country":
        return f"Первый вход пользователя из страны {ev.get('country')} — нетипично, требует проверки."
    if a.detector == "ueba_bulk_export":
        n = " в ночное время" if ev.get("night") else ""
        return f"Выгрузка {ev.get('rows')} записей из {ev.get('resource')}{n} — резко выше нормы поведения пользователя."
    if a.detector == "dlp_iin":
        return f"В исходящих данных обнаружены ИИН ({', '.join(ev.get('samples', []))}) — утечка персональных данных."
    if a.detector == "dlp_card":
        return f"Обнаружены номера карт ({', '.join(ev.get('samples', []))}, прошли проверку Луна) — утечка платёжных данных."
    if a.detector == "dlp_secret":
        return "В данных найден секрет/токен высокой энтропии — риск компрометации доступов."
    if a.detector == "fraud_rule":
        return (f"Транзакция «{ev.get('type')}» на {int(ev.get('amount',0))} ₸, риск-скор {ev.get('score')} "
                f"(паттерн вывода средств). [{ev.get('note')}]")
    if a.detector == "phishing_domain":
        return f"Домен {a.entity}: {', '.join(ev.get('flags', []))} — признаки фишинга."
    return a.title


def build_incident(entity: str, alerts: list[Alert]) -> dict:
    dets = {a.detector for a in alerts}
    cats = {a.category for a in alerts}
    sev = max(a.severity for a in alerts)

    if {"brute_force", "impossible_travel"} & dets and ("anomaly" in cats or "leak" in cats):
        return {
            "title": f"Захват аккаунта {entity}",
            "category": "access",
            "severity": 5,
            "hypothesis": "Подбор пароля → вход из новой страны с невозможной скоростью → массовая выгрузка данных. Классический account takeover с эксфильтрацией.",
            "mitre": ["T1110 Brute Force", "T1078 Valid Accounts", "T1567 Exfiltration"],
            "ai_summary": f"Цепочка событий по {entity} — захват аккаунта с выгрузкой персональных данных. Риск критический.",
            "recommended_actions": ["Заблокировать сессию", "Отозвать токены доступа", "Сбросить пароль", "Аудит выгруженных данных"],
        }
    if "fraud" in cats:
        return {
            "title": "Схема вывода средств",
            "category": "fraud",
            "severity": sev,
            "hypothesis": "Перевод на промежуточный счёт с немедленным обналичиванием — типология отмывания.",
            "mitre": [],
            "ai_summary": f"Подозрительная финансовая активность по {entity}: паттерн перевод→обнал.",
            "recommended_actions": ["Заморозить счёт", "Проверить контрагента", "Сообщить в комплаенс"],
        }
    if "phishing" in cats:
        return {
            "title": f"Фишинговая ссылка ({entity})",
            "category": "phishing",
            "severity": sev,
            "hypothesis": "Домен имитирует доверенный бренд (омоглиф/подозрительный TLD).",
            "mitre": ["T1566 Phishing"],
            "ai_summary": f"Обнаружен фишинговый домen {entity}.",
            "recommended_actions": ["Заблокировать домен", "Оповестить сотрудников"],
        }
    if "leak" in cats:
        return {
            "title": f"Утечка данных ({entity})",
            "category": "leak",
            "severity": sev,
            "hypothesis": "Чувствительные данные (ИИН/карты/секреты) в исходящем потоке.",
            "mitre": ["T1530 Data from Cloud Storage"],
            "ai_summary": f"Зафиксирована утечка чувствительных данных по {entity}.",
            "recommended_actions": ["Заблокировать выгрузку", "Уведомить DPO"],
        }
    a0 = alerts[0]
    return {
        "title": a0.title, "category": a0.category, "severity": sev,
        "hypothesis": "", "mitre": [], "ai_summary": a0.title, "recommended_actions": ["Проверить"],
    }


def nl_query(org_id: str, q: str) -> dict:
    ql = q.lower()
    events: list[CanonicalEvent] = store.events[org_id]

    def f(ev: CanonicalEvent) -> bool:
        ok = True
        if "вход" in ql or "логин" in ql:
            ok &= ev.event_class == "access"
        if "выгруз" in ql or "скач" in ql or "баз" in ql:
            ok &= ev.event_class == "data_activity"
        if "транзак" in ql or "перевод" in ql or "обнал" in ql:
            ok &= ev.event_class == "transaction"
        if "фишинг" in ql or "письм" in ql:
            ok &= ev.event_class == "email"
        if "ноч" in ql:
            try:
                from datetime import datetime
                h = datetime.fromisoformat(ev.ts.replace("Z", "+00:00")).hour
                ok &= 0 <= h <= 5
            except Exception:
                pass
        if "стран" in ql and ev.event_class == "access":
            ok &= bool(ev.actor.country) and ev.actor.country != "KZ"
        return ok

    hits = [e for e in events if f(e)][-50:]
    summary = f"Нашёл {len(hits)} событий по запросу «{q}»." if hits else f"По запросу «{q}» ничего не найдено."
    return {"summary": summary, "count": len(hits), "events": [e.model_dump() for e in hits]}


def chat(org_id: str, message: str, history: list | None = None) -> dict:
    ml = message.lower()
    events: list[CanonicalEvent] = store.events[org_id]
    alerts: list[Alert] = store.alerts[org_id]
    incidents: list[Incident] = store.list_incidents(org_id)
    open_inc = [i for i in incidents if i.status in ("open", "investigating")]
    leaks = [a for a in alerts if a.category == "leak"]
    phishing = [a for a in alerts if a.category == "phishing"]
    fraud = [a for a in alerts if a.category == "fraud"]

    def top_incident() -> Incident | None:
        if not incidents:
            return None
        return max(incidents, key=lambda i: (i.severity, i.score))

    suggestions = [
        "Сколько у нас инцидентов?",
        "Какое событие самое опасное?",
        "Что делать с утечками?",
    ]

    if "событие" in ml:
        token = None
        for w in message.replace(",", " ").split():
            if w.startswith("evt") or w.startswith("ev_") or "_" in w and len(w) > 4:
                token = w.strip(".,!?")
                break
        ev = None
        if token:
            ev = next((e for e in events if e.event_id == token), None)
        if ev is None:
            ids = {e.event_id for e in events}
            for w in message.split():
                if w.strip(".,!?") in ids:
                    ev = next(e for e in events if e.event_id == w.strip(".,!?"))
                    break
        if ev is not None:
            sev = ev.risk.severity
            dets = ", ".join(ev.risk.detectors) or "нет"
            reply = (f"Событие {ev.event_id} ({ev.event_class}/{ev.action or '—'}) в {ev.ts}. "
                     f"Актор: {ev.actor.user or ev.actor.account or '—'} "
                     f"(IP {ev.actor.ip or '—'}, {ev.actor.country or '—'}). "
                     f"Риск-скор {round(ev.risk.score, 2)}, критичность {sev}/5. "
                     f"Сработавшие детекторы: {dets}.")
            return {"reply": reply, "suggestions": [
                "Создать инцидент из этого события?",
                "Кто ещё связан с этим актором?",
                "Что рекомендуете предпринять?",
            ]}
        return {"reply": "Не нашёл событие с таким идентификатором. Уточните event_id.",
                "suggestions": suggestions}

    if any(k in ml for k in ("сколько", "количеств", "статист")):
        if "событ" in ml:
            reply = f"Всего обработано событий: {len(events)}. Из них с алертами: {len(alerts)}."
        elif "алерт" in ml or "трев" in ml:
            reply = f"Зафиксировано алертов: {len(alerts)} (утечки: {len(leaks)}, фишинг: {len(phishing)}, фрод: {len(fraud)})."
        else:
            reply = (f"Инцидентов всего: {len(incidents)}, из них открытых: {len(open_inc)}. "
                     f"Событий: {len(events)}, алертов: {len(alerts)}.")
        return {"reply": reply, "suggestions": suggestions}

    if "утечк" in ml or "dlp" in ml or "иин" in ml or "карт" in ml:
        if leaks:
            ents = ", ".join(sorted({a.entity for a in leaks}))
            reply = (f"Обнаружено {len(leaks)} событий утечки данных. Затронуты: {ents}. "
                     f"Это срабатывания DLP (ИИН/карты/секреты в исходящем потоке).")
        else:
            reply = "Утечек данных пока не зафиксировано."
        return {"reply": reply, "suggestions": [
            "Что делать с утечками?", "Покажи топ-инцидент", "Сколько у нас инцидентов?"]}

    if "фишинг" in ml or "письм" in ml or "домен" in ml:
        if phishing:
            ents = ", ".join(sorted({a.entity for a in phishing}))
            reply = f"Зафиксировано {len(phishing)} фишинговых сигналов. Подозрительные домены: {ents}."
        else:
            reply = "Фишинговых сигналов пока нет."
        return {"reply": reply, "suggestions": [
            "Что делать с фишингом?", "Покажи топ-инцидент", "Сколько событий?"]}

    if "фрод" in ml or "отмыв" in ml or "обнал" in ml or "перевод" in ml:
        if fraud:
            reply = (f"Обнаружено {len(fraud)} подозрительных финансовых операций "
                     f"(паттерн перевод→обнал). Рекомендую заморозить счета и передать в комплаенс.")
        else:
            reply = "Подозрительных финансовых операций не выявлено."
        return {"reply": reply, "suggestions": [
            "Кто инициатор операций?", "Покажи топ-инцидент", "Сколько у нас инцидентов?"]}

    if any(k in ml for k in ("опасн", "критич", "топ", "главн", "серьёзн", "серьезн")):
        top = top_incident()
        if top:
            reply = (f"Самый критичный — «{top.title}» (критичность {top.severity}/5, "
                     f"скор {round(top.score, 2)}, статус {top.status}). {top.ai_summary}")
        else:
            reply = "Критичных инцидентов сейчас нет."
        return {"reply": reply, "suggestions": [
            "Что делать с этим инцидентом?", "Покажи хронологию", "Сколько у нас инцидентов?"]}

    if any(k in ml for k in ("что делать", "рекоменд", "как реагир", "посовет")):
        top = top_incident()
        if top and top.recommended_actions:
            acts = "; ".join(top.recommended_actions)
            reply = f"По наиболее критичному инциденту «{top.title}» рекомендую: {acts}."
        elif leaks:
            reply = "Заблокируйте исходящую выгрузку, уведомите DPO и проведите аудит утёкших данных."
        else:
            reply = "Серьёзных угроз сейчас не вижу — продолжайте мониторинг."
        return {"reply": reply, "suggestions": [
            "Покажи топ-инцидент", "Сколько у нас инцидентов?", "Какие были утечки?"]}

    user_events: list[CanonicalEvent] = []
    matched_user = None
    if "захват" in ml or "аккаунт" in ml:
        for e in events:
            u = e.actor.user
            if u and u.lower() in ml:
                matched_user = u
                break
    if matched_user is None:
        for e in events:
            u = e.actor.user
            if u and u.lower() in ml:
                matched_user = u
                break
    if matched_user:
        user_events = [e for e in events if e.actor.user == matched_user]
        risky = [e for e in user_events if e.risk.severity > 1]
        reply = (f"По пользователю {matched_user}: всего {len(user_events)} событий, "
                 f"из них рискованных {len(risky)}. "
                 + ("Есть признаки захвата аккаунта (подбор/невозможная поездка/выгрузка). "
                    if risky else "Аномалий не обнаружено. "))
        return {"reply": reply, "suggestions": [
            "Что делать с этим аккаунтом?", "Покажи топ-инцидент", "Какие были утечки?"]}

    reply = (f"Сейчас в системе {len(incidents)} инцидентов ({len(open_inc)} открытых), "
             f"{len(alerts)} алертов и {len(events)} событий. Спросите про утечки, фишинг, "
             f"фрод или конкретного пользователя.")
    return {"reply": reply, "suggestions": suggestions}


def report(inc: Incident) -> dict:
    alerts = [a for a in store.alerts[inc.org_id] if a.id in inc.alert_ids]
    lines = [
        f"# Отчёт об инциденте {inc.id}",
        f"**{inc.title}** · критичность {inc.severity}/5 · статус: {inc.status}",
        "",
        "## Резюме",
        inc.ai_summary,
        "",
        "## Хронология",
    ]
    for t in inc.timeline:
        lines.append(f"- `{t['ts']}` — {t['label']}")
    lines += ["", "## Гипотеза", inc.hypothesis, "", "## Рекомендации"]
    lines += [f"- {r}" for r in inc.recommended_actions]
    if inc.mitre:
        lines += ["", "## MITRE ATT&CK", ", ".join(inc.mitre)]
    lines += ["", "---",
              "_Соответствие: Закон РК «О персональных данных и их защите» № 94-V. ИИН обезличены._"]
    md = "\n".join(lines)
    return {
        "incident_id": inc.id,
        "title": inc.title,
        "markdown": md,
        "sections": {
            "summary": inc.ai_summary,
            "timeline": inc.timeline,
            "hypothesis": inc.hypothesis,
            "recommended_actions": inc.recommended_actions,
            "mitre": inc.mitre,
            "alerts": [a.model_dump() for a in alerts],
        },
    }
