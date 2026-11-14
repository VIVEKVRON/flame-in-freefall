"""Entry point to serve the Flame in Freefall Flask API."""

from __future__ import annotations

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "5000"))
    # use_reloader=False prevents Werkzeug from spawning two processes against local-disk Qdrant.
    app.run(host=host, port=port, debug=False, use_reloader=False)
