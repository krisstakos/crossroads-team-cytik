import secrets
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, jsonify, request, session

from .models import User, db


class ApiError(Exception):
    def __init__(self, code, message, status=400, details=None):
        self.code, self.message, self.status, self.details = code, message, status, details or {}


def error_response(e):
    return jsonify({"code": e.code, "message": e.message, "details": e.details}), e.status


def current_user():
    uid = session.get("uid")
    return db.session.get(User, uid) if uid else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        user = current_user()
        if not user:
            raise ApiError("UNAUTHENTICATED", "Sign in to continue.", 401)
        return fn(user, *a, **kw)
    return wrapper


def csrf_token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(24)
    return session["csrf"]


def check_csrf():
    """State-changing calls from a signed-in session must echo the session's CSRF token."""
    if request.method in ("GET", "HEAD", "OPTIONS") or "uid" not in session:
        return
    if not secrets.compare_digest(request.headers.get("X-CSRF-Token", ""), session.get("csrf", "")):
        raise ApiError("CSRF", "Missing or invalid CSRF token.", 403)


_hits = defaultdict(deque)


def rate_limit(key, limit, per_s=60):
    """In-memory sliding window; fine for one process."""
    if current_app.config.get("TESTING") and not current_app.config.get("TEST_RATE_LIMITS"):
        return
    q, t = _hits[key], time.time()
    while q and q[0] < t - per_s:
        q.popleft()
    if len(q) >= limit:
        raise ApiError("RATE_LIMITED", "Too many attempts. Try again in a minute.", 429)
    q.append(t)


def activity(user_id, icon, text, type_):
    from .models import Activity
    db.session.add(Activity(user_id=user_id, icon=icon, text=text, type=type_))
