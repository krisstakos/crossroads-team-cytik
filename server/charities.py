from flask import Blueprint, jsonify

from .common import login_required
from .models import Charity, Task, db

bp = Blueprint("charities", __name__, url_prefix="/api")


@bp.get("/charities")
@login_required
def list_charities(u):
    total = dict(db.session.query(Task.charity_id, db.func.sum(Task.charged_cents)).filter(Task.status == "failed").group_by(Task.charity_id).all())
    mine = dict(db.session.query(Task.charity_id, db.func.sum(Task.charged_cents)).filter(Task.status == "failed", Task.user_id == u.id).group_by(Task.charity_id).all())
    return jsonify([{
        "id": c.id, "name": c.name, "category": c.category, "desc": c.description,
        "goalCents": c.goal_cents, "raisedCents": c.seed_raised_cents + int(total.get(c.id) or 0),
        "yoursCents": int(mine.get(c.id) or 0),
        "impact": {"perCents": c.impact_per_cents, "text": c.impact_text},
    } for c in Charity.query.order_by(Charity.name).all()])
