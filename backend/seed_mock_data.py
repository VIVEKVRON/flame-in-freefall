"""Day -1 standalone script to embed and seed 5 synthetic NASA PSI records into local Qdrant."""

from __future__ import annotations

import logging
from pathlib import Path

from dotenv import load_dotenv

from app.rag.ingest import SYNTHETIC_PSI_RECORDS, seed_records_to_qdrant
from app.rag.qdrant_store import vector_store


def main() -> None:
    backend_root = Path(__file__).resolve().parent
    load_dotenv(backend_root / ".env")

    logging.basicConfig(
        level="INFO",
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        upserted = seed_records_to_qdrant(SYNTHETIC_PSI_RECORDS)
        total = vector_store.count_points()
        print(
            f"Seeded {upserted} synthetic NASA PSI records into Qdrant collection "
            f"'{vector_store.collection_name}' (total points: {total}, path: {vector_store.qdrant_path})."
        )
    finally:
        vector_store.close()


if __name__ == "__main__":
    main()
