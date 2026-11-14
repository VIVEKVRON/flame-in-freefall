"""NASA PSI chunking helpers and Day -1 synthetic microgravity combustion dataset."""

from __future__ import annotations

from typing import Any

from app.rag.qdrant_store import vector_store


def chunk_text(text: str, chunk_size: int = 750, overlap: int = 120) -> list[str]:
    """Split long NASA PSI technical reports into overlapping character windows."""
    cleaned = " ".join(text.split())
    if len(cleaned) <= chunk_size:
        return [cleaned] if cleaned else []

    chunks: list[str] = []
    start = 0
    step = max(1, chunk_size - overlap)
    while start < len(cleaned):
        chunks.append(cleaned[start : start + chunk_size])
        start += step
    return chunks


SYNTHETIC_PSI_RECORDS: list[dict[str, Any]] = [
    {
        "document_id": "NASA-PSI-CYG-2016-SAFF1",
        "experiment": "Saffire-I Spacecraft Fire Experiment",
        "title": "Large-Scale SIBAL Cotton-Fiberglass Flame Spread in ISS-Equivalent Cabin Air",
        "environment": "iss",
        "environment_label": "ISS / Earth (14.7 psi, 21% O2)",
        "pressure_psi": 14.7,
        "oxygen_percent": 21,
        "excerpt": (
            "Full-scale 0.4 m x 0.9 m SIBAL cotton-fiberglass cloth burned at 20 cm/s airflow "
            "exhibited ~1.4x faster flame spread than small-scale glovebox predictions."
        ),
        "text": (
            "Saffire-I burned a full-scale 0.4 m by 0.9 m Cotton-Fiberglass (SIBAL) fabric panel "
            "inside an uncrewed Cygnus spacecraft at 14.7 psi and 21% O2 with a steady 20 cm/s "
            "ventilation flow. Without buoyancy-driven convection in 0g, hot combustion gases "
            "remained close to the fabric surface, lengthening the radiative preheat zone and "
            "producing a flame spread rate approximately 1.4x higher than small-sample predictions "
            "from NASA-STD-6001B 1g upward flame tests."
        ),
    },
    {
        "document_id": "NASA-PSI-CYG-2020-SAFF4",
        "experiment": "Saffire-IV Exploration Atmosphere Fire Test",
        "title": "Elevated-Oxygen Reduced-Pressure Flammability Envelope for Moon Base & Orion",
        "environment": "moonbase",
        "environment_label": "Moon Base (10.2 psi, 30% O2)",
        "pressure_psi": 10.2,
        "oxygen_percent": 30,
        "excerpt": (
            "Under 10.2 psi and 30% O2 exploration atmospheres, reduced total pressure lowers "
            "convective heat loss while elevated O2 raises PMMA and textile spread by ~1.42x."
        ),
        "text": (
            "Saffire-IV and exploration-atmosphere screening evaluate Moon Base and Artemis cabin "
            "conditions at 10.2 psi total pressure and 30% O2 (70% N2). Lowering total pressure "
            "cuts EVA pre-breathe overhead, but reducing nitrogen diluent shrinks heat capacity "
            "and increases radiative-convective heat feedback to solid fuels. PMMA and Nomex "
            "specimens exhibit lower minimum ignition energy (~0.48 mJ) and ~1.42x higher flame "
            "spread rate than sea-level 14.7 psi / 21% O2 air, requiring tighter material screening."
        ),
    },
    {
        "document_id": "NASA-PSI-GLV-2015-BASS2",
        "experiment": "BASS-II (Burning and Suppression of Solids)",
        "title": "Solid Fuel Rod & Sheet Extinction Limits Under Low-Velocity Microgravity Flow",
        "environment": "iss",
        "environment_label": "ISS Microgravity Science Glovebox (14.7 psi, 21% O2)",
        "pressure_psi": 14.7,
        "oxygen_percent": 21,
        "excerpt": (
            "BASS-II opposed-flow PMMA rods peaked in flame spread at 15-30 cm/s airflow before "
            "transitioning to soot-free blue diffusion flamelets near quiescent extinction."
        ),
        "text": (
            "Conducted inside the ISS Microgravity Science Glovebox, BASS-II tested 1-2 cm solid "
            "PMMA rods, spheres, and cotton-fiberglass blends under controlled 0-55 cm/s forced "
            "flows at 14.7 psi and 16-24% O2. Unlike Saffire's large radiative panels, small BASS-II "
            "samples showed a sharp non-monotonic velocity curve: below 10 cm/s, flames turned "
            "soot-free blue and relied purely on Fickian molecular oxygen diffusion; at 15-30 cm/s, "
            "opposed flow accelerated flame spread before blow-off or radiative quenching occurred."
        ),
    },
    {
        "document_id": "NASA-PSI-CIR-2019-FLEX-ACME",
        "experiment": "FLEX & ACME (Flame Extinguishment & Cool Flame Investigations)",
        "title": "Spherical Diffusion Cool Flames, Droplet Extinction & Electric-Field Flame Control",
        "environment": "moonbase",
        "environment_label": "Orbital & Moon Base Envelopes (10.2-14.7 psi, 21-30% O2)",
        "pressure_psi": 10.2,
        "oxygen_percent": 30,
        "excerpt": (
            "FLEX and ACME confirmed that zero-buoyancy droplet and gaseous flames stabilize into "
            "spherical blue cool-flame zones (~600 K) governed by molecular diffusion and radiative loss."
        ),
        "text": (
            "The FLEX (Flame Extinguishment Experiment) and ACME (Advanced Combustion via Microgravity "
            "Experiments) suites aboard the ISS demonstrated that in 0g, elimination of natural "
            "convection produces spherically symmetric diffusion flames rather than flickering teardrops. "
            "During FLEX droplet tests, heptane and methanol flames extinguished visibly yet continued "
            "burning as dim, soot-free spherical cool flames (~600 K) driven by radical chemistry—posing "
            "a stealth fire detection challenge for Moon Base and orbital spacecraft habitats."
        ),
    },
    {
        "document_id": "NASA-PSI-EMU-2022-EVA100",
        "experiment": "Spacesuit EVA & NASA-STD-6001B Pure-O2 Screening",
        "title": "Wire Insulation & Polymer Ignition Sensitivity in 4.3 psi / 100% Oxygen",
        "environment": "spacesuit",
        "environment_label": "Spacesuit EVA (4.3 psi, 100% O2)",
        "pressure_psi": 4.3,
        "oxygen_percent": 100,
        "excerpt": (
            "At 4.3 psi and 100% O2, absence of nitrogen diluent drops minimum ignition energy to "
            "0.14 mJ and multiplies polymer flame spread by ~2.38x over 14.7 psi air."
        ),
        "text": (
            "Extravehicular Mobility Unit (EMU) spacesuits operate at 4.3 psi pure oxygen (100% O2, "
            "0% N2). Because no inert nitrogen is present to absorb reaction enthalpy, FEP/PTFE wire "
            "insulation, hook-and-loop fasteners, and Nomex fabrics face elevated arc-ignition risk "
            "(minimum ignition energy ~0.14 mJ) and ~2.38x flame spread acceleration compared to ISS "
            "sea-level air. Echoing Apollo 13's Tank 2 PTFE wire-arc lessons, NASA-STD-6001B strictly "
            "prohibits unshielded polymer exposure inside 100% O2 enclosures."
        ),
    },
]


def seed_records_to_qdrant(records: list[dict[str, Any]] | None = None) -> int:
    """Embed and upsert PSI records into the configured Qdrant collection."""
    payload = records if records is not None else SYNTHETIC_PSI_RECORDS
    return vector_store.upsert_records(payload)
