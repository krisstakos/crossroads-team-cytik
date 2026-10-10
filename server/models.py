import json
import time

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
now_ms = lambda: int(time.time() * 1000)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(30), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    balance_cents = db.Column(db.Integer, nullable=False, default=0)
    default_stake_cents = db.Column(db.Integer, nullable=False, default=500)
    selected_charity_id = db.Column(db.String(20), db.ForeignKey("charity.id"), default="ocean")
    profile_json = db.Column(db.Text)
    onboarded = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.BigInteger, nullable=False, default=now_ms)

    @property
    def profile(self):
        return json.loads(self.profile_json) if self.profile_json else None


class Charity(db.Model):
    id = db.Column(db.String(20), primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    category = db.Column(db.String(30), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    goal_cents = db.Column(db.Integer, nullable=False)
    seed_raised_cents = db.Column(db.Integer, nullable=False)
    impact_per_cents = db.Column(db.Integer, nullable=False)
    impact_text = db.Column(db.String(120), nullable=False)


class Task(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    icon = db.Column(db.String(8), nullable=False)
    status = db.Column(db.String(10), nullable=False, default="active", index=True)  # active|completed|failed
    stake_cents = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.BigInteger, nullable=False)
    deadline_at = db.Column(db.BigInteger, nullable=False, index=True)
    duration_ms = db.Column(db.BigInteger, nullable=False)
    by_date = db.Column(db.Boolean, nullable=False, default=False)
    completed_at = db.Column(db.BigInteger)
    failed_at = db.Column(db.BigInteger)
    charged_cents = db.Column(db.Integer)
    charity_id = db.Column(db.String(20), db.ForeignKey("charity.id"))
    attempts_used = db.Column(db.Integer, nullable=False, default=0)
    verifying = db.Column(db.Boolean, nullable=False, default=False)


class CaptureChallenge(db.Model):
    nonce = db.Column(db.String(40), primary_key=True)
    task_id = db.Column(db.String(36), db.ForeignKey("task.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    code = db.Column(db.String(3), nullable=False)
    issued_at = db.Column(db.BigInteger, nullable=False)
    expires_at = db.Column(db.BigInteger, nullable=False)
    used_at = db.Column(db.BigInteger)


class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(36), db.ForeignKey("task.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    image_path = db.Column(db.String(255), nullable=False)
    phash = db.Column(db.String(16), nullable=False)
    status = db.Column(db.String(10), nullable=False)  # passed|failed|retry
    verdict_json = db.Column(db.Text)
    provider = db.Column(db.String(20))
    created_at = db.Column(db.BigInteger, nullable=False, default=now_ms)

    @property
    def verdict(self):
        return json.loads(self.verdict_json) if self.verdict_json else None


class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    icon = db.Column(db.String(8), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    at = db.Column(db.BigInteger, nullable=False, default=now_ms)


class Topup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    cents = db.Column(db.Integer, nullable=False)
    at = db.Column(db.BigInteger, nullable=False, default=now_ms)
