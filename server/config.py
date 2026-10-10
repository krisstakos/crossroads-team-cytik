import os

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(BASE, "instance", "commit.db"))
    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(BASE, "instance", "uploads"))
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    VERIFY_MODEL = os.environ.get("VERIFY_MODEL", "claude-sonnet-5-5")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024
    RUN_SCHEDULER = True
    SWEEP_SECONDS = 15
    # rules
    MIN_LEAD_MS = 5 * 60_000
    MAX_LEAD_MS = 365 * 86_400_000
    MAX_DURATION_MS = 72 * 3_600_000
    MIN_STAKE_CENTS = 100
    START_BALANCE_CENTS = 10_000
    MAX_ATTEMPTS = 3
    CHALLENGE_TTL_MS = 10 * 60_000
    PASS_THRESHOLD = 80
    LOGIN_LIMIT = 10          # per minute per IP
    PROOF_LIMIT = 5           # per minute per user
    DAILY_FUNDS_CAP_CENTS = 100_000


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    RUN_SCHEDULER = False
    ANTHROPIC_API_KEY = ""
