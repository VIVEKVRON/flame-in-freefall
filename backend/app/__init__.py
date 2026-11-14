"""Flask application factory and CORS configuration for Flame in Freefall."""

from __future__ import annotations

import atexit
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from app.rag.qdrant_store import vector_store
from app.routes import api_bp


def create_app() -> Flask:
    """Create and configure the Flask backend application."""
    backend_root = Path(__file__).resolve().parent.parent
    load_dotenv(backend_root / ".env")

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    app = Flask(__name__)

    raw_origins = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    app.register_blueprint(api_bp)
    atexit.register(vector_store.close)
    return app
