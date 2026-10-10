import json

from werkzeug.security import generate_password_hash

from .models import Charity, Task, User, db, now_ms

CHARITIES = [
    ("ocean", "Ocean Cleanup Alliance", "Environment", "Removing plastic from oceans and rivers worldwide.", 2000, 1240, 10, "removes about 20 kg of plastic from rivers"),
    ("food", "Food for All", "Hunger", "Serving hot meals to families facing hunger.", 1500, 865, 10, "provides about 4 hot meals"),
    ("green", "Green Earth Initiative", "Environment", "Planting trees and restoring damaged habitats.", 1000, 530, 10, "plants about 5 trees"),
    ("read", "Read Together", "Education", "Putting books in the hands of children who have none.", 800, 410, 10, "buys about 3 children's books"),
    ("water", "Clean Water Now", "Health", "Building wells and filters for villages without safe water.", 1200, 720, 10, "gives one person clean water for a year"),
    ("clinic", "Health Bridge", "Health", "Mobile clinics bringing basic care to remote areas.", 900, 300, 10, "covers about 2 clinic visits"),
]


def seed(app):
    """Idempotent: charities and the demo account (with a little history) if missing."""
    import uuid
    for id_, name, cat, desc, goal, raised, per, text in CHARITIES:
        if not db.session.get(Charity, id_):
            db.session.add(Charity(id=id_, name=name, category=cat, description=desc, goal_cents=goal * 100,
                                   seed_raised_cents=raised * 100, impact_per_cents=per * 100, impact_text=text))
    db.session.commit()
    if User.query.filter_by(username="demo").first():
        return
    u = User(username="demo", name="Demo", password_hash=generate_password_hash("demo123", method="pbkdf2:sha256"), balance_cents=23500,
             default_stake_cents=1000, onboarded=True, profile_json=json.dumps({}))
    db.session.add(u)
    db.session.flush()
    now, H, D = now_ms(), 3_600_000, 86_400_000
    past = [("Stretch break", "🧘", 500, 3 * H, "completed", None), ("Morning run", "🏃", 500, D + 2 * H, "completed", None),
            ("Meal prep", "🍳", 1000, 3 * D + H, "failed", "ocean"), ("Gym visit", "🏋️", 1000, 4 * D + 4 * H, "completed", None),
            ("Tidy the room", "🧹", 500, 8 * D + 2 * H, "failed", "food")]
    for name, icon, stake, ago, status, ch in past:
        at = now - ago
        db.session.add(Task(id=str(uuid.uuid4()), user_id=u.id, name=name, icon=icon, status=status, stake_cents=stake,
                            created_at=at - 2 * H, deadline_at=at, duration_ms=2 * H,
                            completed_at=at - 25 * 60_000 if status == "completed" else None,
                            failed_at=at if status == "failed" else None,
                            charged_cents=stake if status == "failed" else None, charity_id=ch))
    for name, icon, stake, mins in [("Morning workout", "🏋️", 1000, 45), ("Cook dinner", "🍳", 1500, 120), ("Work on my app", "💻", 2000, 360)]:
        db.session.add(Task(id=str(uuid.uuid4()), user_id=u.id, name=name, icon=icon, stake_cents=stake,
                            created_at=now, deadline_at=now + mins * 60_000, duration_ms=mins * 60_000))
    db.session.commit()
