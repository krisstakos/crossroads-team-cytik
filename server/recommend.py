from flask import Blueprint, jsonify

from .common import login_required
from .models import Task, db

bp = Blueprint("recommend", __name__, url_prefix="/api")

RECOMMENDED = [
    {"name": "Gym visit", "icon": "🏋️", "h": 2, "m": 0, "stakeCents": 1000, "tint": "#ffb020", "why": "The classic. Photo of the gym floor."},
    {"name": "Morning run", "icon": "🏃", "h": 1, "m": 0, "stakeCents": 500, "tint": "#7fd3e6", "why": "Short, measurable, easy to prove."},
    {"name": "Study session", "icon": "📚", "h": 1, "m": 0, "stakeCents": 500, "tint": "#9fb4c3", "why": "Open books on a desk is enough."},
    {"name": "Deep work block", "icon": "💻", "h": 2, "m": 0, "stakeCents": 1000, "tint": "#35e0ff", "why": "Two focused hours on one thing."},
    {"name": "Cook dinner", "icon": "🍳", "h": 1, "m": 0, "stakeCents": 500, "tint": "#ffb020", "why": "Skip the takeout, save the stake."},
    {"name": "Tidy the room", "icon": "🧹", "h": 0, "m": 30, "stakeCents": 300, "tint": "#1fb6d4", "why": "A small win in 30 minutes."},
    {"name": "Yoga or stretch", "icon": "🧘", "h": 0, "m": 30, "stakeCents": 500, "tint": "#9fb4c3", "why": "Mat on the floor counts."},
    {"name": "Water the plants", "icon": "🌿", "h": 0, "m": 30, "stakeCents": 300, "tint": "#7fd3e6", "why": "Easy streak starter."},
]


@bp.get("/recommended")
@login_required
def recommended(u):
    active = Task.query.filter_by(user_id=u.id, status="active").all()
    names = {t.name.strip().lower() for t in active}
    icons = {t.icon for t in active}
    done = dict(db.session.query(Task.icon, db.func.count()).filter_by(user_id=u.id, status="completed").group_by(Task.icon).all())
    rows = [(r, i, done.get(r["icon"], 0)) for i, r in enumerate(RECOMMENDED) if r["name"].lower() not in names and r["icon"] not in icons]
    rows.sort(key=lambda x: (-x[2], x[1]))
    return jsonify([{**r, "why": "You have finished this {} time{}.".format(n, "s" if n > 1 else "") if n else r["why"]} for r, _, n in rows])
