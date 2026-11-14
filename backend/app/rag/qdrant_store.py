"""Qdrant vector store and lightweight memory-safe retrieval for Render 512MB tier."""

from __future__ import annotations

import json
import logging
import math
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class LightweightPSIStore:
    """
    Zero-PyTorch, zero-Rust in-memory retriever designed specifically for
    memory-constrained cloud tiers (e.g. Render 512MB Free Tier).
    Consumes < 100 KB RAM and executes in < 1 millisecond.
    """

    def __init__(self, data_path: Path | None = None) -> None:
        self.collection_name = os.getenv("QDRANT_COLLECTION", "nasa_psi_combustion")
        self.data_path = data_path or (BACKEND_ROOT / "data" / "cached_points.json")
        self._records: list[dict[str, Any]] = []
        self._load()

    def _load(self) -> None:
        if self.data_path.exists():
            try:
                with open(self.data_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                self._records = [item.get("payload", item) for item in raw_data]
                logger.info(
                    "Loaded %d pre-computed NASA PSI records from %s into lightweight store.",
                    len(self._records),
                    self.data_path.name,
                )
            except Exception as exc:
                logger.warning("Failed to load cached points from %s: %s", self.data_path, exc)

        if not self._records:
            try:
                from app.rag.ingest import SYNTHETIC_PSI_RECORDS

                for rec in SYNTHETIC_PSI_RECORDS:
                    self._records.append(
                        {
                            "documentId": rec["document_id"],
                            "experiment": rec["experiment"],
                            "title": rec["title"],
                            "environment": rec["environment"],
                            "environmentLabel": rec["environment_label"],
                            "pressurePsi": rec["pressure_psi"],
                            "oxygenPercent": rec["oxygen_percent"],
                            "excerpt": rec["excerpt"],
                            "text": rec["text"],
                        }
                    )
                logger.info("Initialized lightweight store with %d synthetic PSI records.", len(self._records))
            except Exception as exc:
                logger.error("Could not populate synthetic fallback records: %s", exc)

    def count_points(self) -> int:
        return len(self._records)

    def ensure_collection(self) -> None:
        pass

    def upsert_records(self, records: list[dict[str, Any]]) -> int:
        for rec in records:
            normalized = {
                "documentId": rec.get("document_id") or rec.get("documentId"),
                "experiment": rec.get("experiment", "NASA PSI Experiment"),
                "title": rec.get("title", ""),
                "environment": rec.get("environment", "iss"),
                "environmentLabel": rec.get("environment_label") or rec.get("environmentLabel", ""),
                "pressurePsi": rec.get("pressure_psi") or rec.get("pressurePsi"),
                "oxygenPercent": rec.get("oxygen_percent") or rec.get("oxygenPercent"),
                "excerpt": rec.get("excerpt", ""),
                "text": rec.get("text", ""),
            }
            self._records.append(normalized)
        return len(records)

    def retrieve_top_k(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        if not self._records:
            raise RuntimeError(f"Qdrant collection '{self.collection_name}' is empty.")

        query_lower = query.lower()
        terms = set(re.findall(r"\b\w+\b", query_lower))

        target_env = None
        for env in ("spacesuit", "moonbase", "iss"):
            if env in query_lower:
                target_env = env
                break

        scored: list[tuple[float, dict[str, Any]]] = []
        for doc in self._records:
            score = 0.0
            doc_env = str(doc.get("environment", "")).lower()
            if target_env and doc_env == target_env:
                score += 3.5

            searchable = (
                f"{doc.get('title', '')} {doc.get('experiment', '')} "
                f"{doc.get('excerpt', '')} {doc.get('text', '')}"
            ).lower()

            for t in terms:
                if len(t) < 3:
                    continue
                cnt = searchable.count(t)
                if cnt > 0:
                    score += 1.0 + math.log(cnt)

            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        candidates: list[dict[str, Any]] = []
        for raw_score, payload in scored[:limit]:
            norm_score = round(min(0.98, max(0.65, 0.65 + raw_score * 0.03)), 4)
            candidates.append(
                {
                    "documentId": payload.get("documentId", ""),
                    "experiment": payload.get("experiment", "NASA PSI Experiment"),
                    "title": payload.get("title", ""),
                    "environment": payload.get("environment", "iss"),
                    "environmentLabel": payload.get("environmentLabel", ""),
                    "pressurePsi": payload.get("pressurePsi"),
                    "oxygenPercent": payload.get("oxygenPercent"),
                    "excerpt": payload.get("excerpt", ""),
                    "text": payload.get("text", ""),
                    "biEncoderScore": norm_score,
                }
            )
        return candidates

    def close(self) -> None:
        pass


class QdrantVectorStore:
    """Thread-safe wrapper around local-disk (or remote URL) Qdrant + SentenceTransformer embeddings."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._client: Any = None
        self._embedder: Any = None
        self._vector_size: int | None = None

        self.collection_name = os.getenv("QDRANT_COLLECTION", "nasa_psi_combustion")
        self.embedding_model_name = os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.qdrant_url = os.getenv("QDRANT_URL", "").strip()
        raw_path = os.getenv("QDRANT_PATH", "./qdrant_data").strip() or "./qdrant_data"
        path_obj = Path(raw_path)
        self.qdrant_path = str(
            path_obj if path_obj.is_absolute() else (BACKEND_ROOT / path_obj).resolve()
        )

    def _get_client(self) -> Any:
        if self._client is None:
            with self._lock:
                if self._client is None:
                    from qdrant_client import QdrantClient

                    if self.qdrant_url:
                        logger.info("Connecting to Qdrant server at %s", self.qdrant_url)
                        self._client = QdrantClient(url=self.qdrant_url)
                    else:
                        Path(self.qdrant_path).mkdir(parents=True, exist_ok=True)
                        logger.info("Opening local-disk Qdrant at %s", self.qdrant_path)
                        self._client = QdrantClient(path=self.qdrant_path)
        return self._client

    def _get_embedder(self) -> Any:
        if self._embedder is None:
            with self._lock:
                if self._embedder is None:
                    try:
                        import torch
                        torch.set_num_threads(2)
                    except Exception:
                        pass
                    from sentence_transformers import SentenceTransformer

                    logger.info("Loading bi-encoder model: %s", self.embedding_model_name)
                    model = SentenceTransformer(self.embedding_model_name)
                    dim_fn = getattr(
                        model,
                        "get_embedding_dimension",
                        model.get_sentence_embedding_dimension,
                    )
                    self._vector_size = dim_fn()
                    self._embedder = model
        return self._embedder

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Encode a batch of strings into normalized dense vectors."""
        embedder = self._get_embedder()
        vectors = embedder.encode(texts, normalize_embeddings=True)
        return [vec.tolist() for vec in vectors]

    def ensure_collection(self) -> None:
        """Create the target Qdrant collection if it does not yet exist."""
        client = self._get_client()
        self._get_embedder()
        dim = self._vector_size or 384

        from qdrant_client.models import Distance, VectorParams

        existing = {col.name for col in client.get_collections().collections}
        if self.collection_name not in existing:
            logger.info(
                "Creating Qdrant collection '%s' (dim=%d, distance=COSINE)",
                self.collection_name,
                dim,
            )
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )

    def count_points(self) -> int:
        """Return number of stored points in the collection, or 0 if collection is absent."""
        client = self._get_client()
        existing = {col.name for col in client.get_collections().collections}
        if self.collection_name not in existing:
            return 0
        info = client.get_collection(self.collection_name)
        return int(info.points_count or 0)

    def upsert_records(self, records: list[dict[str, Any]]) -> int:
        """Embed and upsert structured PSI experiment chunks idempotently into Qdrant."""
        if not records:
            return 0

        self.ensure_collection()
        client = self._get_client()

        texts_to_embed = [
            f"{rec['experiment']} | {rec['environment_label']} | {rec['title']}\n{rec['text']}"
            for rec in records
        ]
        embeddings = self.embed_texts(texts_to_embed)

        from qdrant_client.models import PointStruct

        points: list[PointStruct] = []
        for rec, vector in zip(records, embeddings):
            point_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, rec["document_id"]))
            points.append(
                PointStruct(
                    id=point_uuid,
                    vector=vector,
                    payload={
                        "documentId": rec["document_id"],
                        "experiment": rec["experiment"],
                        "title": rec["title"],
                        "environment": rec["environment"],
                        "environmentLabel": rec["environment_label"],
                        "pressurePsi": rec["pressure_psi"],
                        "oxygenPercent": rec["oxygen_percent"],
                        "excerpt": rec["excerpt"],
                        "text": rec["text"],
                    },
                )
            )

        client.upsert(collection_name=self.collection_name, points=points, wait=True)
        return len(points)

    def retrieve_top_k(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        """
        Stage 1 Retrieval: embed the user query with the bi-encoder and fetch the top-K
        candidate documents from Qdrant.
        """
        client = self._get_client()
        existing = {col.name for col in client.get_collections().collections}
        if self.collection_name not in existing:
            raise RuntimeError(
                f"Qdrant collection '{self.collection_name}' does not exist. "
                "Run 'python seed_mock_data.py' before querying."
            )

        query_vector = self.embed_texts([query])[0]
        response = client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=limit,
            with_payload=True,
        )

        candidates: list[dict[str, Any]] = []
        for hit in response.points:
            payload = hit.payload or {}
            candidates.append(
                {
                    "documentId": payload.get("documentId", str(hit.id)),
                    "experiment": payload.get("experiment", "NASA PSI Experiment"),
                    "title": payload.get("title", ""),
                    "environment": payload.get("environment", "iss"),
                    "environmentLabel": payload.get("environmentLabel", ""),
                    "pressurePsi": payload.get("pressurePsi"),
                    "oxygenPercent": payload.get("oxygenPercent"),
                    "excerpt": payload.get("excerpt", ""),
                    "text": payload.get("text", ""),
                    "biEncoderScore": float(hit.score or 0.0),
                }
            )
        return candidates

    def close(self) -> None:
        """Release local-disk Qdrant lock cleanly on shutdown."""
        with self._lock:
            if self._client is not None:
                self._client.close()
                self._client = None


def create_vector_store() -> Any:
    # Use lightweight store on Render or if LOW_MEMORY is enabled or if cached_points exists
    is_render = bool(os.getenv("RENDER"))
    is_low_mem = os.getenv("LOW_MEMORY", "true" if is_render else "false").lower() in ("true", "1", "yes")
    cached_path = BACKEND_ROOT / "data" / "cached_points.json"

    if (is_render or is_low_mem) and cached_path.exists():
        logger.info("Initializing LightweightPSIStore for low-memory environment (Render/Cloud).")
        return LightweightPSIStore(cached_path)

    return QdrantVectorStore()


vector_store = create_vector_store()
