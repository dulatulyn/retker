from fastapi.testclient import TestClient

from app.main import app


def main() -> None:
    with TestClient(app) as c:
        ok = 0

        assert c.get("/").json()["status"] == "ok"; ok += 1
        print("✓ health")

        r = c.post("/v1/auth/login", json={"username": "demo", "password": "demo12345"})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        H = {"Authorization": f"Bearer {token}"}
        ok += 1
        print("✓ login demo")

        me = c.get("/v1/auth/me", headers=H).json()
        key = me["org"]["api_key"]
        assert key == "demo-key-123"
        print(f"✓ me — org «{me['org']['name']}», api_key={key}")
        ok += 1

        ov = c.get("/v1/overview", headers=H).json()
        k = ov["kpis"]
        print(f"✓ overview — событий={k['events_24h']}, инцидентов открыто={k['open_incidents']}, "
              f"утечек={k['leaks_prevented']}, разбивка={[b['category'] for b in ov['breakdown']]}")
        assert k["events_24h"] > 0 and k["open_incidents"] >= 1
        ok += 1

        incs = c.get("/v1/incidents", headers=H).json()
        titles = [i["title"] for i in incs]
        print(f"✓ инциденты ({len(incs)}): {titles}")
        assert any("Захват аккаунта" in t for t in titles)
        first = incs[0]["id"]
        det = c.get(f"/v1/incidents/{first}", headers=H).json()
        print(f"  детально #{first}: алертов={len(det['alerts'])}, severity={det['incident']['severity']}")
        b = c.post(f"/v1/incidents/{first}/block", headers=H).json()
        assert b["status"] == "blocked"
        print("✓ блокировка инцидента")
        ok += 1

        KH = {"X-Org-Key": key}
        leak_iin = "900101350011"
        r = c.post("/v1/events/data", headers=KH, json={
            "user": "t.test", "resource": "db.clients", "action": "export",
            "rows": 5000, "content": "ИИН 901010350010, карта 4242 4242 4242 4242"})
        out = r.json()
        print(f"✓ ingest/data по X-Org-Key — risk severity={out['risk']['severity']}, "
              f"детекторы={out['risk']['detectors']}")
        assert out["risk"]["severity"] >= 4
        ok += 1

        c.post("/v1/events/access", headers=KH, json={
            "ts": "2026-06-24T10:00:00Z", "user": "z.zhan", "country": "KZ", "success": True})
        r = c.post("/v1/events/access", headers=KH, json={
            "ts": "2026-06-24T10:20:00Z", "user": "z.zhan", "country": "KR", "success": True})
        print(f"✓ ingest/access — impossible travel детекторы={r.json()['risk']['detectors']}")
        ok += 1

        q = c.post("/v1/query", headers=H, json={"q": "покажи входы из новых стран ночью"}).json()
        print(f"✓ query — {q['summary']}")
        ok += 1

        rep = c.get(f"/v1/reports/{first}", headers=H).json()
        assert "# Отчёт об инциденте" in rep["markdown"]
        print(f"✓ отчёт сгенерирован ({len(rep['markdown'])} символов)")
        ok += 1

        print(f"\n=== ВСЕ {ok} ПРОВЕРОК ПРОШЛИ ✅ ===")


if __name__ == "__main__":
    main()
