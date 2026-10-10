---
name: flask
description: Build and modify Flask applications — app factory, blueprints, request handling, validation, error handlers, extensions (SQLAlchemy, Flask-Migrate, Flask-Login/JWT), configuration, and testing with the test client. Use when working in a Flask project or adding routes, blueprints, or Flask extensions.
---

# Flask work

## Before writing code
1. Confirm it is Flask: check `pyproject.toml`/`requirements*.txt` for `flask` and find the app entry point (`create_app`, `app = Flask(...)`, `wsgi.py`, `flask --app`).
2. Read the existing layout: blueprints, extensions setup, config classes, and how the database session is managed. Match it.
3. Check the Python and Flask versions. Flask 2.2+ and 3.x changed some APIs (e.g. `app.json` provider, removed `before_first_request`); don't copy old examples.
4. Find the test command and the dependency/lock tool (pip, uv, poetry) and use the same one for any new dependency.

## Structure
- **Use the application factory.** `create_app(config)` builds the app, initializes extensions, and registers blueprints. Don't create the app at import time with global side effects.
- **Initialize extensions unbound, then bind:** e.g. `db = SQLAlchemy()` at module level, `db.init_app(app)` inside the factory. Never call `init_app` on the same extension twice.
- **One blueprint per resource or feature.** Put routes in the blueprint, business logic in a service module, and data access in models/repositories. Keep route functions thin.
- **Config via classes** (`DevelopmentConfig`, `TestingConfig`, `ProductionConfig`) loaded from environment variables. Read secrets from the environment only; never hard-code `SECRET_KEY`. Fail fast at startup if a required secret is missing in production.
- **Register error handlers** with `@app.errorhandler` or `@blueprint.errorhandler` for a consistent JSON error envelope (match the existing one). Handle `HTTPException` and your own domain exceptions; don't let stack traces leak in production.

## Requests and responses
- **Validate every input** before use: `request.get_json(silent=False)` for bodies, `request.args` for query params, and route converters (`<int:id>`) for path params. Use the project's validation library (Pydantic, marshmallow, WTForms, or Flask-Smorest) if one exists; otherwise validate explicitly and return 400/422.
- **Return explicit status codes:** `return jsonify(data), 201`. Use `abort(404)` or `raise NotFound` for missing resources.
- **Authorize per object** in the handler or a decorator. Decorators like `@login_required` check login; object ownership is still your job.
- **Don't rely on the global `request`/`g`/`session` outside a request context.** Pass values explicitly to services.
- **Limit body size:** set `MAX_CONTENT_LENGTH`.
- **Use `url_for`** for generated links instead of hard-coded paths.

## Database (Flask-SQLAlchemy / Flask-Migrate)
- Define models in one place and import them before `create_all` or migrations so metadata is complete.
- Use Flask-Migrate (`flask db migrate` / `flask db upgrade`) for schema changes; review the generated migration (autogenerate misses some changes, such as certain constraints and renames). Follow the `database-schema` skill for rollout rules.
- Keep sessions scoped to the request. Commit explicitly in the service layer; roll back on exceptions. Let Flask-SQLAlchemy remove the session at app teardown; don't manage global sessions yourself.
- Avoid lazy-loading relationships in loops (N+1). Use `selectinload`/`joinedload` in SQLAlchemy 2.x style (`db.session.execute(select(...))`), and see the `query-performance` skill.
- Avoid the legacy `Model.query` API in new code if the project uses SQLAlchemy 2.x; match the project's existing style.

## Auth
- Use the extension the project already uses (Flask-Login for sessions, Flask-JWT-Extended for tokens). Don't roll your own password hashing: use `werkzeug.security.generate_password_hash` or `argon2`/`bcrypt` via the project's helper.
- Set cookie flags for session cookies in production: `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SAMESITE`.
- Protect state-changing requests from CSRF when using cookie auth (Flask-WTF `CSRFProtect` or equivalent) — API token auth needs no CSRF token but must not also accept cookies silently.

## Running and testing
- Use the CLI: `flask --app <module> run --debug` for development only. Production runs under a WSGI server (gunicorn, uwsgi) — never `app.run` or `--debug` in production.
- Test with `app.test_client()` and a `TestingConfig` (`TESTING = True`) using an isolated database. Use an application-context fixture for DB work. See the `backend-testing` skill for isolation rules.
- Test the CLI commands with `app.test_cli_runner()` if you add any.
- Exercise changed routes in a real run when feasible (`flask run`, then a request with curl), and report the actual output.

## Done checklist
- [ ] Created via the app factory; extensions initialized with `init_app`
- [ ] Blueprint registered; route handlers thin; logic in services
- [ ] Config from environment; no hard-coded secrets; production settings safe
- [ ] Input validated; status codes explicit; errors use the standard envelope
- [ ] Object-level authorization checked, with a test for a forbidden caller
- [ ] Migrations generated and reviewed (if schema changed)
- [ ] Test client tests added; the project's test command run and its output reported
