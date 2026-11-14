"""API endpoints for microgravity combustion telemetry and two-stage PSI RAG chat."""

from __future__ import annotations

import time
from typing import Any

from flask import Blueprint, jsonify, request

from app.rag.qdrant_store import vector_store
from app.rag.reranker import qwen3_reranker
from app.rag.synthesizer import ENVIRONMENT_DESCRIPTIONS, synthesize_answer

api_bp = Blueprint("api", __name__, url_prefix="/api")

VALID_ENVIRONMENTS = {"spacesuit", "moonbase", "iss"}

ENVIRONMENT_ALIASES = {
    "spacesuit": "spacesuit",
    "spacesuit eva": "spacesuit",
    "eva": "spacesuit",
    "moonbase": "moonbase",
    "moon base": "moonbase",
    "iss": "iss",
    "iss / earth": "iss",
    "earth": "iss",
}


def _normalize_environment(raw_env: Any) -> str:
    if not isinstance(raw_env, str):
        return "iss"
    cleaned = " ".join(raw_env.strip().lower().split())
    return ENVIRONMENT_ALIASES.get(cleaned, "iss")

ENVIRONMENT_PROFILES: dict[str, dict[str, Any]] = {
    "spacesuit": {
        "id": "spacesuit",
        "label": "Spacesuit EVA",
        "pressurePsi": 4.3,
        "oxygenPercent": 100,
        "nitrogenPercent": 0,
        "gravityG": 0.0,
        "flameSpreadMultiplier": 2.38,
        "minimumIgnitionEnergyMj": 0.14,
    },
    "moonbase": {
        "id": "moonbase",
        "label": "Moon Base",
        "pressurePsi": 10.2,
        "oxygenPercent": 30,
        "nitrogenPercent": 70,
        "gravityG": 0.165,
        "flameSpreadMultiplier": 1.42,
        "minimumIgnitionEnergyMj": 0.48,
    },
    "iss": {
        "id": "iss",
        "label": "ISS / Earth",
        "pressurePsi": 14.7,
        "oxygenPercent": 21,
        "nitrogenPercent": 79,
        "gravityG": 0.0,
        "flameSpreadMultiplier": 1.0,
        "minimumIgnitionEnergyMj": 0.92,
    },
}


@api_bp.get("/health")
def health_check():
    """Return service and Qdrant collection readiness."""
    try:
        points_count = vector_store.count_points()
        return jsonify(
            {
                "status": "ok",
                "collection": vector_store.collection_name,
                "pointsCount": points_count,
            }
        )
    except Exception as exc:
        return jsonify({"status": "degraded", "error": str(exc)}), 500


@api_bp.get("/data")
def get_environment_data():
    """Return calibrated environmental combustion telemetry presets."""
    env = (request.args.get("environment") or "iss").strip().lower()
    if env not in VALID_ENVIRONMENTS:
        return (
            jsonify(
                {
                    "error": f"Unsupported environment '{env}'. Expected one of {sorted(VALID_ENVIRONMENTS)}."
                }
            ),
            400,
        )
    return jsonify({"environment": ENVIRONMENT_PROFILES[env]})


@api_bp.post("/chat")
def chat():
    """
    Two-stage NASA PSI RAG endpoint:
      1. Bi-encoder (all-MiniLM-L6-v2) query embedding + top-10 Qdrant retrieval.
      2. Cross-encoder (Qwen/Qwen3-Reranker-0.6B) reranking down to top-3 contexts.
      3. Gemini API structured synthesis aligned with the frontend contract.
    """
    started = time.perf_counter()
    payload = request.get_json(silent=True) or {}

    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "Request JSON must include a non-empty 'query' string."}), 400
    query = query.strip()

    environment = _normalize_environment(payload.get("environment", "iss"))

    env_context = ENVIRONMENT_DESCRIPTIONS.get(environment, environment)
    enriched_query = f"{query} [Mission Environment: {env_context}]"

    try:
        candidates = vector_store.retrieve_top_k(enriched_query, limit=10)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Qdrant retrieval failed: {exc}"}), 500

    top_docs, _used_qwen3 = qwen3_reranker.rerank(
        query=query,
        candidates=candidates,
        top_n=3,
        environment=env_context,
    )

    synthesized = synthesize_answer(
        query=query,
        environment=environment,
        ranked_docs=top_docs,
    )

    elapsed_ms = int((time.perf_counter() - started) * 1000)

    return jsonify(
        {
            "answer": synthesized["answer"],
            "citations": synthesized["citations"],
            "environmentApplied": environment,
            "latencyMs": elapsed_ms,
        }
    )
