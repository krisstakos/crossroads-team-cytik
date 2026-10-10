import threading
import time


def start(app):
    from .tasks import settle_overdue

    def loop():
        while True:
            time.sleep(app.config["SWEEP_SECONDS"])
            try:
                with app.app_context():
                    settle_overdue()
            except Exception:  # keep sweeping; a bad pass must not kill the thread
                app.logger.exception("sweep failed")

    threading.Thread(target=loop, daemon=True, name="settle-sweeper").start()
