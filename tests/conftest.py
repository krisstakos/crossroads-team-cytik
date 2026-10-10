import io
import random

import pytest
from PIL import Image

from server import create_app
from server.config import TestConfig
from server.models import db
from server.seed import seed


@pytest.fixture
def app(tmp_path):
    class C(TestConfig):
        UPLOAD_DIR = str(tmp_path / "uploads")
    app = create_app(C)
    with app.app_context():
        seed(app)
    return app


class Client:
    def __init__(self, app):
        self.c = app.test_client()
        self.csrf = None

    def req(self, method, url, **kw):
        h = kw.pop("headers", {})
        if self.csrf:
            h["X-CSRF-Token"] = self.csrf
        r = getattr(self.c, method)(url, headers=h, **kw)
        if r.is_json and isinstance(r.json, dict) and "csrf" in r.json:
            self.csrf = r.json["csrf"]
        return r

    get = lambda self, u, **k: self.req("get", u, **k)
    post = lambda self, u, **k: self.req("post", u, **k)
    patch = lambda self, u, **k: self.req("patch", u, **k)
    put = lambda self, u, **k: self.req("put", u, **k)
    delete = lambda self, u, **k: self.req("delete", u, **k)


@pytest.fixture
def client(app):
    c = Client(app)
    r = c.post("/api/auth/register", json={"name": "Ann", "username": "ann", "password": "secret1"})
    assert r.status_code == 201
    return c


@pytest.fixture
def other(app):
    c = Client(app)
    c.post("/api/auth/register", json={"name": "Bob", "username": "bob", "password": "secret2"})
    return c


def photo(seed=1):
    rnd = random.Random(seed)
    img = Image.new("RGB", (64, 64))
    img.putdata([(rnd.randrange(256),) * 3 for _ in range(64 * 64)])
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    buf.seek(0)
    return buf


def mk_task(c, minutes=30, stake=500, name="Gym visit"):
    import time
    r = c.post("/api/tasks", json={"name": name, "icon": "🏋️", "stakeCents": stake, "deadlineAt": int(time.time() * 1000) + minutes * 60_000})
    assert r.status_code == 201, r.json
    return r.json


def submit(c, tid, seed=1):
    ch = c.post(f"/api/tasks/{tid}/challenge").json
    return c.post(f"/api/tasks/{tid}/proof", data={"nonce": ch["nonce"], "image": (photo(seed), "p.jpg")}, content_type="multipart/form-data")
