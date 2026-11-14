"""
Document Ingestion Pipeline for Flame in Freefall.

Parses raw NASA PSI PDF technical reports from backend/data/raw/,
chunks the content into 500-word segments (with 50-word overlap),
extracts and tags microgravity combustion metadata (environment, pressure, oxygen, experiment),
embeds the chunks using sentence-transformers (all-MiniLM-L6-v2),
and upserts them directly into the local Qdrant collection (`nasa_psi_combustion`).
"""

from __future__ import annotations

import argparse
import logging
import re
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.rag.agentic_scraper import ensure_output_dir, generate_authoritative_nasa_pdfs
from app.rag.qdrant_store import vector_store

logger = logging.getLogger("ingest_resources")

BACKEND_ROOT = Path(__file__).resolve().parent
DEFAULT_RAW_DIR = BACKEND_ROOT / "data" / "raw"


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract raw textual content from a PDF using pypdf with PyPDF2 fallback."""
    text_content: list[str] = []

    try:
        import pypdf

        reader = pypdf.PdfReader(str(pdf_path))
        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_content.append(page_text.strip())
    except Exception as exc:
        logger.warning("pypdf failed on %s (%s); trying PyPDF2 fallback...", pdf_path.name, exc)
        try:
            import PyPDF2

            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    pt = page.extract_text() or ""
                    if pt.strip():
                        text_content.append(pt.strip())
        except Exception as pypdf2_exc:
            logger.error("PyPDF2 also failed on %s: %s", pdf_path.name, pypdf2_exc)

    return "\n\n".join(text_content)


def chunk_words(text: str, chunk_size_words: int = 500, overlap_words: int = 50) -> list[str]:
    """Split text into chunks of specified word length with sliding overlap."""
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size_words:
        return [" ".join(words)]

    chunks: list[str] = []
    start = 0
    step = max(1, chunk_size_words - overlap_words)
    while start < len(words):
        chunk_slice = words[start : start + chunk_size_words]
        chunks.append(" ".join(chunk_slice))
        start += step
        if start + overlap_words >= len(words) and start < len(words):
            # Capture the trailing remainder
            chunks.append(" ".join(words[start:]))
            break
    return chunks


def infer_metadata_from_chunk(chunk: str, doc_name: str, chunk_idx: int) -> dict[str, Any]:
    """
    Infer environment, pressure, oxygen concentration, and experiment name from chunk context.
    Maps cleanly to the existing Qdrant schema used across the backend and frontend.
    """
    lower = chunk.lower()

    # Default baseline: ISS / Earth Cabin
    environment = "iss"
    env_label = "ISS / Earth (14.7 psi, 21% O2)"
    pressure_psi = 14.7
    oxygen_percent = 21.0

    # Spacesuit EVA detection
    if any(k in lower for k in ["spacesuit", "emu", "extravehicular", "pure oxygen", "100% o2", "4.3 psi"]):
        environment = "spacesuit"
        env_label = "Spacesuit EVA (4.3 psi, 100% O2)"
        pressure_psi = 4.3
        oxygen_percent = 100.0
    # Moon Base / Exploration Atmosphere detection
    elif any(k in lower for k in ["moon base", "lunar", "artemis", "10.2 psi", "30% o2", "exploration atmosphere"]):
        environment = "moonbase"
        env_label = "Moon Base (10.2 psi, 30% O2)"
        pressure_psi = 10.2
        oxygen_percent = 30.0

    # Specific regex overrides if numerical data is explicitly cited in the text
    psi_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:psi|psia|kpa)", lower)
    if psi_match:
        try:
            val = float(psi_match.group(1))
            if 3.0 <= val <= 20.0:
                pressure_psi = val
        except ValueError:
            pass

    o2_match = re.search(r"(\d+(?:\.\d+)?)\s*%\s*(?:o2|oxygen)", lower)
    if o2_match:
        try:
            val = float(o2_match.group(1))
            if 15.0 <= val <= 100.0:
                oxygen_percent = val
        except ValueError:
            pass

    # Experiment attribution
    experiment = "NASA PSI Microgravity Combustion"
    if "bass" in lower or "psi-117" in lower or "bass-ii" in lower:
        experiment = "BASS-II / PSI-117 (Burning and Suppression of Solids)"
    elif "saffire" in lower:
        experiment = "Saffire Spacecraft Fire Safety Investigation"
    elif "flex" in lower or "droplet" in lower:
        experiment = "FLEX (Flame Extinguishment Experiment)"
    elif "acme" in lower or "cir" in lower:
        experiment = "ACME / CIR (Combustion Integrated Rack)"
    elif "6001b" in lower or "wire" in lower or "arc" in lower:
        experiment = "NASA-STD-6001B Flammability Screening"

    # Human-readable title
    clean_stem = doc_name.replace(".pdf", "").replace("-", " ").replace("_", " ")
    title = f"{clean_stem.title()} - Section {chunk_idx + 1}"

    # Concise excerpt (first 1-2 sentences)
    sentences = re.split(r"(?<=[.!?])\s+", chunk)
    excerpt = " ".join(sentences[:2]) if len(sentences) >= 2 else (sentences[0] if sentences else "")
    if len(excerpt) > 280:
        excerpt = excerpt[:277] + "..."

    # Unique deterministic ID
    doc_slug = re.sub(r"[^A-Za-z0-9]+", "-", doc_name).strip("-")
    document_id = f"NASA-PSI-{doc_slug}-C{chunk_idx + 1:03d}"

    return {
        "document_id": document_id,
        "experiment": experiment,
        "title": title,
        "environment": environment,
        "environment_label": env_label,
        "pressure_psi": float(pressure_psi),
        "oxygen_percent": float(oxygen_percent),
        "excerpt": excerpt,
        "text": chunk,
    }


def ingest_directory(raw_dir: Path) -> int:
    """
    Extract, chunk, embed, and upsert all PDF files in raw_dir into Qdrant.
    Returns the total number of records upserted.
    """
    ensure_output_dir(raw_dir)
    pdf_files = sorted(raw_dir.glob("*.pdf"))

    if not pdf_files:
        logger.info("No PDF files found in %s. Generating authoritative baseline NASA reports...", raw_dir)
        pdf_files = generate_authoritative_nasa_pdfs(raw_dir)

    all_records: list[dict[str, Any]] = []

    print("\n" + "=" * 70)
    print(f"PROCESSING {len(pdf_files)} NASA TECHNICAL PDF FILES")
    print("=" * 70)

    for pdf_path in pdf_files:
        text = extract_text_from_pdf(pdf_path)
        if not text.strip():
            logger.warning("No extractable text found in %s; skipping.", pdf_path.name)
            continue

        chunks = chunk_words(text, chunk_size_words=500, overlap_words=50)
        print(f"  • {pdf_path.name:<45} -> {len(chunks)} chunks ({len(text.split()):,} words)")

        for c_idx, chunk_text in enumerate(chunks):
            rec = infer_metadata_from_chunk(chunk_text, pdf_path.name, c_idx)
            all_records.append(rec)

    if not all_records:
        logger.warning("No records were extracted from the PDF files in %s.", raw_dir)
        return 0

    print("-" * 70)
    print(f"EMBEDDING & UPSERTING {len(all_records)} CHUNKS INTO QDRANT...")
    print(f"Target Collection: '{vector_store.collection_name}' | Model: {vector_store.embedding_model_name}")

    upserted_count = vector_store.upsert_records(all_records)
    total_points = vector_store.count_points()

    print("=" * 70)
    print("INGESTION COMPLETE:")
    print(f"  • Chunks Upserted : {upserted_count}")
    print(f"  • Total in Qdrant : {total_points} points")
    print(f"  • Database Path   : {vector_store.qdrant_path}")
    print("=" * 70 + "\n")

    return upserted_count


def main() -> None:
    backend_root = Path(__file__).resolve().parent
    load_dotenv(backend_root / ".env")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(description="Ingest NASA PSI PDF reports into Qdrant vector store")
    parser.add_argument(
        "--raw-dir",
        type=str,
        default=str(DEFAULT_RAW_DIR),
        help=f"Path to directory containing PDF files (default: {DEFAULT_RAW_DIR})",
    )

    args = parser.parse_args()
    target_raw_dir = Path(args.raw_dir)

    try:
        ingest_directory(target_raw_dir)
    finally:
        vector_store.close()


if __name__ == "__main__":
    main()
