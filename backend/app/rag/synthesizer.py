"""Gemini API (google-genai) structured synthesis + graceful offline fallback."""

from __future__ import annotations

import logging
import os
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class CitationItem(BaseModel):
    experiment: str = Field(description="NASA PSI experiment name.")
    documentId: str = Field(description="Document identifier from context.")
    relevance: float = Field(description="Normalized relevance score between 0 and 1.")
    excerpt: str = Field(description="Concise supporting telemetry excerpt.")


class SynthesisOutput(BaseModel):
    answer: str = Field(
        description=(
            "Technical aerospace combustion analysis grounded strictly in the provided "
            "NASA PSI excerpts and calibrated for the requested mission environment."
        )
    )
    citations: list[CitationItem] = Field(
        description="Up to 3 citations corresponding to the reranked PSI contexts."
    )


ENVIRONMENT_DESCRIPTIONS: dict[str, str] = {
    "spacesuit": "Spacesuit EVA (4.3 psi, 100% O2, 0.00 g)",
    "moonbase": "Moon Base Habitat (10.2 psi, 30% O2, 0.165 g)",
    "iss": "ISS / Earth Cabin (14.7 psi, 21% O2, 0.00 g)",
}


def _build_fallback_synthesis(
    query: str,
    environment: str,
    ranked_docs: list[dict[str, Any]],
    reason: str,
) -> dict[str, Any]:
    env_label = ENVIRONMENT_DESCRIPTIONS.get(environment, environment.upper())
    bullets = "\n\n".join(
        f"• {doc['experiment']} ({doc['documentId']}, score={doc.get('rerankScore', 0):.2f}): "
        f"{doc['text']}"
        for doc in ranked_docs
    )
    answer = (
        f"[PSI-RAG SYNTHESIS // {env_label}]\n\n"
        f"QUERY: {query}\n\n"
        f"{bullets}\n\n"
        f"NOTE: {reason}"
    )
    citations = [
        {
            "experiment": doc["experiment"],
            "documentId": doc["documentId"],
            "relevance": float(doc.get("rerankScore", doc.get("biEncoderScore", 0.5))),
            "excerpt": doc["excerpt"],
        }
        for doc in ranked_docs
    ]
    return {"answer": answer, "citations": citations}


def synthesize_answer(
    query: str,
    environment: str,
    ranked_docs: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Synthesize a structured JSON answer from the top-3 Qwen3-reranked contexts using
    the official `google-genai` Interactions API (`gemini-3.8-flash`).
    """
    if not ranked_docs:
        return {
            "answer": "No matching NASA PSI combustion records were found in Qdrant.",
            "citations": [],
        }

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return _build_fallback_synthesis(
            query,
            environment,
            ranked_docs,
            "Gemini synthesis bypassed (set GEMINI_API_KEY in backend/.env to enable live LLM reasoning).",
        )

    primary_model = (
        os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
    )
    fallback_model = (
        os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite").strip()
        or "gemini-3.5-flash-lite"
    )
    candidate_models = list(
        dict.fromkeys([primary_model, fallback_model, "gemini-3.1-flash-lite"])
    )
    env_label = ENVIRONMENT_DESCRIPTIONS.get(environment, environment)

    context_block = "\n\n".join(
        (
            f"[DOC {idx + 1}] id={doc['documentId']} | experiment={doc['experiment']} | "
            f"env={doc.get('environmentLabel', '')} | rerank_score={doc.get('rerankScore', 0):.4f}\n"
            f"EXCERPT: {doc.get('excerpt', '')}\n"
            f"TEXT: {doc.get('text', '')}"
        )
        for idx, doc in enumerate(ranked_docs)
    )

    system_instruction = (
        "You are an elite NASA microgravity combustion safety engineer. "
        "Answer the user's question using ONLY the provided reranked NASA PSI contexts. "
        "Highlight quantitative pressure (psi), O2 concentration (%), flame spread multipliers, "
        "and zero-buoyancy diffusion physics relevant to the active mission environment."
    )

    user_input = (
        f"Active Mission Environment: {env_label}\n"
        f"Engineer Query: {query}\n\n"
        f"Top Reranked NASA PSI Contexts:\n{context_block}"
    )

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=25000,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )

    for model_name in candidate_models:
        try:
            interaction = client.interactions.create(
                model=model_name,
                input=user_input,
                system_instruction=system_instruction,
                store=False,
                timeout=25.0,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": SynthesisOutput.model_json_schema(),
                },
            )
            if not interaction.output_text:
                raise ValueError("Empty response from Gemini Interactions API.")
            parsed = SynthesisOutput.model_validate_json(interaction.output_text)
            return parsed.model_dump()
        except Exception as exc:  # pragma: no cover - transient 503/network resilience
            logger.warning(
                "Gemini synthesis with '%s' failed (%s).", model_name, exc
            )

    logger.error("All Gemini synthesis models failed; using deterministic fallback.")
    return _build_fallback_synthesis(
        query,
        environment,
        ranked_docs,
        "Gemini API models were temporarily unavailable (503/rate-limit); returned reranked Qwen3 contexts directly.",
    )
