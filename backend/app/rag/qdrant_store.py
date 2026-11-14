"""Qdrant local-disk vector store and bi-encoder embedding retrieval (Stage 1)."""

from __future__ import annotations

import logging
import os
import threading
import uuid
from pathlib import Path
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class QdrantVectorStore:
    """Thread-safe wrapper around local-disk (or remote URL) Qdrant + SentenceTransformer embeddings."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._client: QdrantClient | None = None
        self._embedder: SentenceTransformer | None = None
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

    def _get_client(self) -> QdrantClient:
        if self._client is None:
            with self._lock:
                if self._client is None:
                    if self.qdrant_url:
                        logger.info("Connecting to Qdrant server at %s", self.qdrant_url)
                        self._client = QdrantClient(url=self.qdrant_url)
                    else:
                        Path(self.qdrant_path).mkdir(parents=True, exist_ok=True)
                        logger.info("Opening local-disk Qdrant at %s", self.qdrant_path)
                        self._client = QdrantClient(path=self.qdrant_path)
        return self._client

    def _get_embedder(self) -> SentenceTransformer:
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


vector_store = QdrantVectorStore()
