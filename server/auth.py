import re

from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from .common import ApiError, activity, csrf_token, current_user, login_required, rate_limit
from .models import Charity, Task, User, db, now_ms

bp = Blueprint("auth", __name__, url_prefix="/api")
USERNAME_RE = re.compile(r"^[a-z0-9._-]{2,20}$")


def validate_registration(v):
    e = {}
    name = (v.get("name") or "").strip()
    u = (v.get("username") or "").strip().lower()
    pw = v.get("password") or ""
    if not name:
        e["name"] = "Enter your name."
    elif len(name) > 30:
        e["name"] = "Use 30 characters or fewer."
    if not u:
        e["username"] = "Choose a username."
    elif not USERNAME_RE.match(u):
        e["username"] = "Use 2 to 20 letters, numbers, dots, dashes or underscores."
    elif User.query.filter_by(username=u).first():
        e["username"] = "That username is taken."
    if len(pw) < 6:
        e["password"] = "Use at least 6 characters."
    elif pw.lower() == u:
        e["password"] = "Your password cannot be your username."
    return e


def user_json(u):
    return {
        "username": u.username, "name": u.name, "balanceCents": u.balance_cents,
        "defaultStakeCents": u.default_stake_cents, "selectedCharityId": u.selected_charity_id,
        "profile": u.profile, "onboarded": u.onboarded, "csrf": csrf_token(),
        "availableCents": available_cents(u),
    }


def available_cents(u):
    reserved = db.session.query(db.func.coalesce(db.func.sum(Task.stake_cents), 0)).filter_by(user_id=u.id, status="active").scalar()
    return u.balance_cents - reserved


@bp.post("/auth/register")
def register():
    v = request.get_json(silent=True) or {}
    rate_limit("reg:" + (request.remote_addr or ""), current_app.config["LOGIN_LIMIT"])
    errors = validate_registration(v)
    if errors:
        raise ApiError("VALIDATION", "Check the highlighted fields.", 422, errors)
    u = User(username=v["username"].strip().lower(), name=v["name"].strip(),
             password_hash=generate_password_hash(v["password"], method="pbkdf2:sha256"),
             balance_cents=current_app.config["START_BALANCE_CENTS"])
    db.session.add(u)
    db.session.flush()
    activity(u.id, "💰", "Account funded with $100.00", "funds")
    db.session.commit()
    session.clear()
    session["uid"] = u.id
    return jsonify(user_json(u)), 201


@bp.post("/auth/login")
def login():
    v = request.get_json(silent=True) or {}
    rate_limit("login:" + (request.remote_addr or ""), current_app.config["LOGIN_LIMIT"])
    u = User.query.filter_by(username=(v.get("username") or "").strip().lower()).first()
    if not u:
        raise ApiError("NO_ACCOUNT", "No account with that username.", 401, {"signup": True})
    if not check_password_hash(u.password_hash, v.get("password") or ""):
        raise ApiError("BAD_PASSWORD", "That password does not match this username.", 401)
    session.clear()
    session["uid"] = u.id
    return jsonify(user_json(u))


@bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@bp.get("/me")
@login_required
def me(u):
    return jsonify(user_json(u))


@bp.patch("/me")
@login_required
def patch_me(u):
    import json
    v = request.get_json(silent=True) or {}
    if "defaultStakeCents" in v:
        c = v["defaultStakeCents"]
        if not isinstance(c, int) or c < current_app.config["MIN_STAKE_CENTS"]:
            raise ApiError("VALIDATION", "Enter a valid amount.", 422)
        u.default_stake_cents = c
    if "profile" in v:
        u.profile_json = json.dumps(v["profile"])[:4000]
    if "onboarded" in v:
        u.onboarded = bool(v["onboarded"])
    db.session.commit()
    return jsonify(user_json(u))


@bp.put("/me/charity")
@login_required
def select_charity(u):
    cid = (request.get_json(silent=True) or {}).get("id")
    if not db.session.get(Charity, cid):
        raise ApiError("NOT_FOUND", "Unknown charity.", 404)
    u.selected_charity_id = cid
    db.session.commit()
    return jsonify(user_json(u))


@bp.post("/me/funds")
@login_required
def add_funds(u):
    from .models import Topup
    c = (request.get_json(silent=True) or {}).get("amountCents")
    if not isinstance(c, int) or c <= 0:
        raise ApiError("VALIDATION", "Enter a valid amount.", 422)
    day_total = db.session.query(db.func.coalesce(db.func.sum(Topup.cents), 0)).filter(
        Topup.user_id == u.id, Topup.at > now_ms() - 86_400_000).scalar()
    if day_total + c > current_app.config["DAILY_FUNDS_CAP_CENTS"]:
        raise ApiError("FUNDS_CAP", "Daily top-up limit reached.", 422)
    u.balance_cents += c
    db.session.add(Topup(user_id=u.id, cents=c))
    activity(u.id, "💰", "Added ${:,.2f} to account".format(c / 100), "funds")
    db.session.commit()
    return jsonify(user_json(u))
