"""
Flask application factory — no Redis, no Celery.
Rate limiting uses in-memory storage (sufficient for development).
"""
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import Config
from routes.auth_routes import auth_bp
from routes.task_routes import tasks_bp
from routes.generation_routes import generation_bp
from routes.admin_routes import admin_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS(
        app,
        resources={r"/api/*": {"origins": [Config.FRONTEND_URL, "http://localhost:3000"]}},
        supports_credentials=True,
    )

    # ── Rate Limiting (in-memory) ─────────────────────────────────────────────
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["100 per minute"],
        storage_uri="memory://",  # No Redis required
    )

    # Stricter limit on AI generation endpoint
    limiter.limit("10 per hour")(generation_bp)

    # ── Blueprints ────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(generation_bp)
    app.register_blueprint(admin_bp)

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health")
    def health():  # type: ignore[return]
        return {"status": "ok", "version": "1.0.0"}

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5000, debug=True)
