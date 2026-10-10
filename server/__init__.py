import os

from flask import Flask, jsonify, send_from_directory

from .common import ApiError, check_csrf, error_response
from .config import BASE, Config
from .models import Task, db


def create_app(config=None):
    app = Flask(__name__, static_folder=BASE, static_url_path="")
    app.config.from_object(config or Config)
    os.makedirs(os.path.join(BASE, "instance"), exist_ok=True)
    db.init_app(app)

    from . import auth, charities, recommend, tasks, verification, assist
    for m in (auth, tasks, charities, verification, recommend, assist):
        app.register_blueprint(m.bp)

    app.before_request(lambda: check_csrf() if _is_api() else None)
    app.register_error_handler(ApiError, error_response)
    app.register_error_handler(413, lambda e: error_response(ApiError("TOO_LARGE", "Photo is too large.", 413)))
    app.register_error_handler(404, lambda e: error_response(ApiError("NOT_FOUND", "Not found.", 404)) if _is_api() else e)

    @app.get("/")
    def index():
        return send_from_directory(BASE, "index.html")

    with app.app_context():
        db.create_all()
        Task.query.update({Task.verifying: False})   # a crash mid-verification must not freeze a task
        db.session.commit()
        if not app.config.get("TESTING"):
            from .seed import seed
            seed(app)
    if app.config["RUN_SCHEDULER"] and (not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true"):
        from . import scheduler
        scheduler.start(app)
    return app


def _is_api():
    from flask import request
    return request.path.startswith("/api/")
