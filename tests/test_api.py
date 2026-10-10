import time

from server import verification
from server.models import Task, User, db, now_ms
from server.tasks import settle_overdue
from tests.conftest import Client, mk_task, photo, submit


def test_register_validation(app):
    c = Client(app)
    r = c.post("/api/auth/register", json={"name": "", "username": "A!", "password": "x"})
    assert r.status_code == 422 and set(r.json["details"]) == {"name", "username", "password"}
    assert c.post("/api/auth/register", json={"name": "A", "username": "demo", "password": "secret1"}).json["details"]["username"] == "That username is taken."


def test_login_and_csrf(app, client):
    assert client.get("/api/me").json["balanceCents"] == 10_000
    bare = app.test_client()
    assert bare.get("/api/me").status_code == 401
    c2 = Client(app)
    assert c2.post("/api/auth/login", json={"username": "nobody", "password": "x"}).json["code"] == "NO_ACCOUNT"
    assert c2.post("/api/auth/login", json={"username": "ann", "password": "bad"}).json["code"] == "BAD_PASSWORD"
    assert c2.post("/api/auth/login", json={"username": "ann", "password": "secret1"}).status_code == 200
    c2.csrf = "wrong"
    assert c2.post("/api/tasks", json={}).status_code == 403


def test_create_limits_and_overcommit(client):
    t = lambda **kw: client.post("/api/tasks", json={"name": "x", "icon": "🏋️", "stakeCents": 500, "deadlineAt": now_ms() + 600_000, **kw})
    assert t(deadlineAt=now_ms() + 60_000).json["code"] == "DEADLINE_TOO_SOON"
    assert t(deadlineAt=now_ms() + 80 * 3_600_000).json["code"] == "DEADLINE_TOO_FAR"
    assert t(deadlineAt=now_ms() + 80 * 3_600_000, byDate=True).status_code == 201
    assert t(stakeCents=50).status_code == 422
    assert t(stakeCents=9501).json["code"] == "INSUFFICIENT_FUNDS"   # 10000 balance - 500 reserved
    assert t(stakeCents=9500).status_code == 201
    assert t(stakeCents=100).json["code"] == "INSUFFICIENT_FUNDS"


def test_tasks_cannot_be_deleted(app, client):
    """Once created, a task stays until it is completed or missed: there is no delete route at all."""
    tid = mk_task(client)["id"]
    assert client.delete(f"/api/tasks/{tid}").status_code == 405
    assert "deletableUntil" not in client.get(f"/api/tasks").json[0]
    assert any(t["id"] == tid for t in client.get("/api/tasks").json)


def test_settlement_idempotent_and_charity_snapshot(app, client):
    tid = mk_task(client, stake=2500)["id"]
    client.put("/api/me/charity", json={"id": "food"})
    before = {c["id"]: c for c in client.get("/api/charities").json}["food"]["raisedCents"]
    with app.app_context():
        db.session.get(Task, tid).deadline_at = now_ms() - 1000
        db.session.commit()
        assert settle_overdue() == 1
        assert settle_overdue() == 0
        u = User.query.filter_by(username="ann").one()
        assert u.balance_cents == 7500
    t = [x for x in client.get("/api/tasks").json if x["id"] == tid][0]
    assert t["status"] == "failed" and t["chargedCents"] == 2500 and t["charityId"] == "food"
    ch = {c["id"]: c for c in client.get("/api/charities").json}
    assert ch["food"]["yoursCents"] == 2500 and ch["food"]["raisedCents"] == before + 2500


def test_charge_never_exceeds_balance(app, client):
    tid = mk_task(client, stake=10_000)["id"]
    with app.app_context():
        User.query.filter_by(username="ann").one().balance_cents = 300
        db.session.get(Task, tid).deadline_at = now_ms() - 1
        db.session.commit()
        settle_overdue()
        assert User.query.filter_by(username="ann").one().balance_cents == 0
        assert db.session.get(Task, tid).charged_cents == 300


def test_proof_passes_and_owner_scoping(app, client, other, monkeypatch):
    monkeypatch.setattr(verification.MockVerifier, "verify", lambda s, j, t, c: {"verdict": "verified", "confidence": 90, "detected": ["x"], "note": "ok"})
    tid = mk_task(client)["id"]
    r = submit(client, tid)
    assert r.status_code == 200 and r.json["task"]["status"] == "completed"
    assert client.get(f"/api/tasks/{tid}/proof/image").status_code == 200
    assert other.get(f"/api/tasks/{tid}/proof/image").status_code == 404
    assert other.post(f"/api/tasks/{tid}/challenge").status_code == 404
    assert tid not in [t["id"] for t in other.get("/api/tasks").json]


def test_attempts_and_duplicate_and_nonce(app, client, monkeypatch):
    monkeypatch.setattr(verification.MockVerifier, "verify", lambda s, j, t, c: {"verdict": "rejected", "confidence": 40, "detected": [], "note": "no"})
    tid = mk_task(client)["id"]
    for i in range(3):
        r = submit(client, tid, seed=i + 10)
        assert r.status_code == 200 and r.json["status"] == "failed"
    assert client.post(f"/api/tasks/{tid}/challenge").json["code"] == "ATTEMPTS_EXHAUSTED"
    # nonce reuse and wrong task
    tid2 = mk_task(client)["id"]
    ch = client.post(f"/api/tasks/{tid2}/challenge").json
    ok = client.post(f"/api/tasks/{tid2}/proof", data={"nonce": ch["nonce"], "image": (photo(99), "p.jpg")}, content_type="multipart/form-data")
    assert ok.status_code == 200
    again = client.post(f"/api/tasks/{tid2}/proof", data={"nonce": ch["nonce"], "image": (photo(98), "p.jpg")}, content_type="multipart/form-data")
    assert again.json["code"] == "CHALLENGE_USED"
    # duplicate photo (same seed as an earlier one)
    assert submit(client, tid2, seed=99).json["code"] == "DUPLICATE_PHOTO"


def test_provider_error_does_not_consume_attempt(app, client, monkeypatch):
    def boom(s, j, t, c):
        raise verification.ProviderError("timeout")
    monkeypatch.setattr(verification.MockVerifier, "verify", boom)
    tid = mk_task(client)["id"]
    r = submit(client, tid)
    assert r.status_code == 503 and r.json["code"] == "VERIFIER_UNAVAILABLE"
    assert [t for t in client.get("/api/tasks").json if t["id"] == tid][0]["attemptsLeft"] == 3
    with app.app_context():
        assert not db.session.get(Task, tid).verifying


def test_expired_challenge_and_bad_image(app, client):
    from server.models import CaptureChallenge
    tid = mk_task(client)["id"]
    ch = client.post(f"/api/tasks/{tid}/challenge").json
    with app.app_context():
        db.session.get(CaptureChallenge, ch["nonce"]).expires_at = now_ms() - 1
        db.session.commit()
    r = client.post(f"/api/tasks/{tid}/proof", data={"nonce": ch["nonce"], "image": (photo(), "p.jpg")}, content_type="multipart/form-data")
    assert r.json["code"] == "CHALLENGE_EXPIRED"
    import io
    ch = client.post(f"/api/tasks/{tid}/challenge").json
    r = client.post(f"/api/tasks/{tid}/proof", data={"nonce": ch["nonce"], "image": (io.BytesIO(b"nope"), "p.jpg")}, content_type="multipart/form-data")
    assert r.json["code"] == "BAD_IMAGE"


def test_funds_cap_and_recommended(client):
    assert client.post("/api/me/funds", json={"amountCents": 5000}).json["balanceCents"] == 15_000
    assert client.post("/api/me/funds", json={"amountCents": 999_999}).json["code"] == "FUNDS_CAP"
    names = [r["name"] for r in client.get("/api/recommended").json]
    assert names[0] == "Gym visit"


def test_assist_places_live_and_fallback(client, monkeypatch):
    from server import assist
    assist._cache.clear()
    monkeypatch.setattr(assist, "fetch_places", lambda k, lat, lon: [{"name": "Iron Gym", "km": 0.4}])
    r = client.get("/api/assist/places?kind=gym&lat=42.69&lon=23.32").json
    assert r == {"places": [{"name": "Iron Gym", "km": 0.4}], "source": "openstreetmap"}

    def down(*a):
        raise RuntimeError("overpass down")
    assist._cache.clear()
    monkeypatch.setattr(assist, "fetch_places", down)
    assert client.get("/api/assist/places?kind=gym&lat=1&lon=2").json == {"places": [], "source": "unavailable"}
    assert client.get("/api/assist/places?kind=nope&lat=1&lon=2").status_code == 422


def test_claude_verifier_parses_and_maps_errors(app, monkeypatch):
    import types
    from server import verification

    class Fake:
        def __init__(self, text):
            self.text = text
            self.messages = self

        def create(self, **kw):
            assert kw["messages"][0]["content"][0]["type"] == "image"
            if self.text is None:
                raise TimeoutError("slow")
            return types.SimpleNamespace(content=[types.SimpleNamespace(type="text", text=self.text)])

    task = types.SimpleNamespace(name="Gym visit", icon="🏋️")
    with app.app_context():
        app.config["ANTHROPIC_API_KEY"] = "k"
        import anthropic
        monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: Fake('ok {"confidence": 91, "detected": ["rack"], "note": "Looks right."} done'))
        v = verification.ClaudeVerifier().verify(b"x", task, "123")
        assert v["verdict"] == "verified" and v["confidence"] == 91 and v["detected"] == ["rack"]
        monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: Fake('{"confidence": 40, "detected": [], "note": "no"}'))
        assert verification.ClaudeVerifier().verify(b"x", task, "123")["verdict"] == "rejected"
        for bad in ("not json", None):
            monkeypatch.setattr(anthropic, "Anthropic", lambda bad=bad, **kw: Fake(bad))
            try:
                verification.ClaudeVerifier().verify(b"x", task, "123")
                assert False, "should raise"
            except verification.ProviderError:
                pass
