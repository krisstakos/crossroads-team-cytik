import uuid

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import update

from .auth import available_cents
from .common import ApiError, activity, login_required
from .models import Activity, Charity, Submission, Task, User, db, now_ms

bp = Blueprint("tasks", __name__, url_prefix="/api")


def settle_overdue(user_id=None):
    """Forfeit overdue active tasks. Safe to call from the sweeper and from requests at once:
    the conditional UPDATE only matches rows that are still active."""
    q = Task.query.filter(Task.status == "active", Task.deadline_at < now_ms(), Task.verifying.is_(False))
    if user_id:
        q = q.filter(Task.user_id == user_id)
    n = 0
    for t in q.limit(200).all():
        u = db.session.get(User, t.user_id)
        charged = min(t.stake_cents, max(0, u.balance_cents))
        charity = db.session.get(Charity, u.selected_charity_id)
        res = db.session.execute(update(Task).where(Task.id == t.id, Task.status == "active").values(
            status="failed", failed_at=now_ms(), charged_cents=charged, charity_id=u.selected_charity_id))
        if res.rowcount:
            u.balance_cents -= charged
            activity(u.id, "💸", 'Missed "{}" — ${:,.2f} sent to {}'.format(t.name, charged / 100, charity.name), "penalty")
            n += 1
    db.session.commit()
    return n


def task_json(t):
    cfg = current_app.config
    sub = Submission.query.filter_by(task_id=t.id, status="passed").first() if t.status == "completed" else None
    out = {
        "id": t.id, "name": t.name, "icon": t.icon, "status": t.status, "byDate": t.by_date,
        "createdAt": t.created_at, "deadline": t.deadline_at, "durationMs": t.duration_ms,
        "penaltyCents": t.stake_cents, "completedAt": t.completed_at, "failedAt": t.failed_at,
        "chargedCents": t.charged_cents, "charityId": t.charity_id,
        "attemptsLeft": max(0, cfg["MAX_ATTEMPTS"] - t.attempts_used),
    }
    if sub:
        v = sub.verdict
        out["proof"] = {"image": "/api/tasks/{}/proof/image".format(t.id),
                        "ai": {**v, "at": sub.created_at, "provider": sub.provider}}
    return out


@bp.get("/tasks")
@login_required
def list_tasks(u):
    settle_overdue(u.id)
    tasks = Task.query.filter_by(user_id=u.id).order_by(Task.created_at.desc()).all()
    return jsonify([task_json(t) for t in tasks])


@bp.get("/activity")
@login_required
def list_activity(u):
    rows = Activity.query.filter_by(user_id=u.id).order_by(Activity.at.desc(), Activity.id.desc()).limit(30).all()
    return jsonify([{"icon": a.icon, "text": a.text, "at": a.at, "type": a.type} for a in rows])


@bp.post("/tasks")
@login_required
def create_task(u):
    cfg = current_app.config
    v = request.get_json(silent=True) or {}
    name = (v.get("name") or "").strip()
    icon = (v.get("icon") or "🏋️")[:8]
    stake = v.get("stakeCents")
    by_date = bool(v.get("byDate"))
    deadline = v.get("deadlineAt")
    if not name or len(name) > 40:
        raise ApiError("VALIDATION", "Give your task a name (40 characters or fewer).", 422)
    if not isinstance(stake, int) or stake < cfg["MIN_STAKE_CENTS"]:
        raise ApiError("VALIDATION", "The minimum stake is $1.", 422)
    if not isinstance(deadline, int):
        raise ApiError("VALIDATION", "Set a deadline.", 422)
    now = now_ms()
    lead = deadline - now
    if lead < cfg["MIN_LEAD_MS"]:
        raise ApiError("DEADLINE_TOO_SOON", "Pick a time at least 5 minutes from now.", 422)
    if lead > cfg["MAX_LEAD_MS"]:
        raise ApiError("DEADLINE_TOO_FAR", "Due dates can be up to a year away.", 422)
    if not by_date and lead > cfg["MAX_DURATION_MS"]:
        raise ApiError("DEADLINE_TOO_FAR", "Time limits can be up to 72 hours.", 422)
    settle_overdue(u.id)
    avail = available_cents(u)
    if stake > avail:
        raise ApiError("INSUFFICIENT_FUNDS", "Your stake is more than your available balance.", 422, {"availableCents": avail})
    t = Task(id=str(uuid.uuid4()), user_id=u.id, name=name, icon=icon, stake_cents=stake, created_at=now,
             deadline_at=deadline, duration_ms=lead, by_date=by_date)
    db.session.add(t)
    db.session.commit()
    return jsonify(task_json(t)), 201


def owned_task(u, tid):
    t = db.session.get(Task, tid)
    if not t or t.user_id != u.id:
        raise ApiError("NOT_FOUND", "Task not found.", 404)
    return t
