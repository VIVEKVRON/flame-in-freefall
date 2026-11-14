# Flame in Freefall: Zero-Gravity Fire Safety Intelligence

**2026 NASA Space Apps Challenge Project**  
**Developed by Team Vetris (Vivek V Ron)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg?logo=next.dot.js)](https://nextjs.org/)
[![Flask 3.1](https://img.shields.io/badge/Backend-Flask%203.1-000000.svg?logo=flask)](https://flask.palletsprojects.com/)
[![Qdrant Vector DB](https://img.shields.io/badge/Vector%20Store-Qdrant%20Local-red.svg?logo=qdrant)](https://qdrant.tech/)
[![Reranker](https://img.shields.io/badge/Reranker-Qwen3--Reranker--0.6B-orange.svg)](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)
[![Gemini API](https://img.shields.io/badge/LLM-Google%20Gemini%20Flash-4285F4.svg?logo=google)](https://ai.google.dev/)

---

## 1. Executive Summary

Fire behaves fundamentally differently in microgravity. Without buoyancy-driven convection, buoyant hot gases cannot rise, creating spherical, oxygen-starved flames with low burning temperatures that can persist invisibly or reignite unexpectedly under altered airflow.

**Flame in Freefall** is an operational zero-gravity combustion safety intelligence platform built for astronauts, life support engineers, and mission designers. It transforms complex microgravity combustion data from the **NASA Physical Science Informatics (PSI)** system into an interactive, real-time spatial decision support platform.

Users can simulate flammability envelopes and query critical flame propagation dynamics across three distinct mission environments:
- **Spacesuit EVA:** $4.3\text{ psi}$, $100\%\ \text{O}_2$, $0.0\text{ g}$ (Extreme Flammability Hazard)
- **Moon Base Habitat:** $10.2\text{ psi}$, $30\%\ \text{O}_2$, $0.16\text{ g}$ (Elevated Flame Spread Risk)
- **ISS / Earth Normal:** $14.7\text{ psi}$, $21\%\ \text{O}_2$, $0.0\text{ g}$ (Nominal Baseline Convection Quench)

---

## 2. System Architecture & Tech Stack

The platform is designed as an enterprise-grade monorepo combining a high-performance Next.js 16 reactive frontend and a multi-stage Python Flask RAG intelligence pipeline.

```
                              ┌──────────────────────────────────────────────┐
                              │           Next.js 16 Web Dashboard           │
                              │  - GSAP ScrollTrigger Rocket Storytelling    │
                              │  - 60 FPS Telemetry Reticle Cursor           │
                              │  - Global Mission Environment Context        │
                              │  - Recharts Flammability Limits Curves       │
                              └──────────────────────┬───────────────────────┘
                                                     │ HTTP /api/chat
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                             Python Flask Backend (WSGI)                            │
│                                                                                    │
│   ┌────────────────────────────────────────────────────────────────────────────┐   │
│   │ Stage 1: Dense Retrieval                                                   │   │
│   │ - Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)           │   │
│   │ - Vector Store: Qdrant Local-Disk Persistence (nasa_psi_combustion)        │   │
│   │ - Candidate Extraction: Top-10 Cosine Similarity Documents                 │   │
│   └─────────────────────────────────────┬──────────────────────────────────────┘   │
│                                         │ Top-10 Candidates                        │
│                                         ▼                                          │
│   ┌────────────────────────────────────────────────────────────────────────────┐   │
│   │ Stage 2: Cross-Encoder Neural Reranking                                    │   │
│   │ - Model: Qwen/Qwen3-Reranker-0.6B                                          │   │
│   │ - Scoring: Query-Document Cross-Attention Logits                           │   │
│   │ - Selection: Top-4 Reranked Documents with Normalized Relevance Scores    │   │
│   └─────────────────────────────────────┬──────────────────────────────────────┘   │
│                                         │ Top-4 Reranked Documents                 │
│                                         ▼                                          │
│   ┌────────────────────────────────────────────────────────────────────────────┐   │
│   │ Stage 3: SuperIntelligence (SI) Synthesis                                  │   │
│   │ - Google Gemini (Interactions API with automated fallback cascade)         │   │
│   │ - Grounded Telemetry Synthesis with strict citation schema                 │   │
│   └────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Technology Stack
- **Framework:** [Next.js 16](https://nextjs.org/) (React 19, App Router, TypeScript)
- **Styling & HUD UI:** [Tailwind CSS](https://tailwindcss.com/) with aerospace telemetry dark-mode aesthetic
- **High-Performance Physics Animations:** [GSAP 3](https://greensock.com/gsap/) (`gsap.quickTo()` for lag-free 60 FPS telemetry cursor reticle tracking, and `ScrollTrigger` for diagonal Space Shuttle orbital ascent)
- **Data Visualizations:** [Recharts](https://recharts.org/) rendering NASA material flammability curves (PMMA, Nomex, Cotton, FEP)
- **State Management:** React Context (`EnvironmentContext`) distributing ambient pressure, oxygen fraction, and gravity values to all components

### Backend Technology Stack
- **Framework:** [Flask 3.1](https://flask.palletsprojects.com/) with `Flask-CORS`
- **WSGI Production Server:** [Gunicorn](https://gunicorn.org/) (`--workers 1 --threads 4 --timeout 180`) to guarantee thread-safe access to local Qdrant SQLite storage without file-lock contention
- **Vector Database:** [Qdrant](https://qdrant.tech/) with local disk persistence (`./qdrant_data`), pre-seeded with 9 embedded research vectors
- **Bi-Encoder Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` generating 384-dimensional cosine dense vectors
- **Neural Cross-Encoder Reranker:** `Qwen/Qwen3-Reranker-0.6B` executing full cross-attention query-document passage ranking
- **Autonomous Scraper:** [Playwright](https://playwright.dev/) + [browser-use](https://github.com/browser-use/browser-use) autonomous web scraper traversing the dynamic NASA PSI catalog and extracting technical investigation PDFs

---

## 3. NASA Open Data Integration

This project directly leverages data and standards provided by NASA:

1. **NASA Physical Science Informatics (PSI) Repository:**
   - **PSI-117 (BASS-II / Burning and Suppression of Solids-II):** Investigating fuel thickness, low-speed airflow velocities ($v \le 5\text{ cm/s}$), and extinction limits of solid spherical and flat fuels aboard the ISS.
   - **Saffire-IV (Spacecraft Fire Safety Experiment):** Large-scale material combustion tests conducted in unmanned Cygnus cargo vehicles at exploration atmospheres ($p = 10.2\text{ psi}$, $30\%\ \text{O}_2$).
   - **FLEX & ACME Investigations:** Droplet combustion, soot formation, and spherical cool flame extinction phenomena in zero gravity.

2. **NASA Standard NASA-STD-6001B:**
   - *Flammability, Offgassing, and Compatibility Requirements and Test Procedures for Materials in Environments that Support Combustion.*
   - Test 1 (Upward Flame Propagation) and Test 2 (Heat and Visible Smoke Release Rates) parameters mapped directly into the platform's flammability boundary curves.

3. **Data Preservation:**
   - Pre-parsed technical PDFs are archived under `backend/data/raw/`.
   - The compiled Qdrant vector database is committed under `backend/qdrant_data/` to ensure zero cold-start latency on deployment without repeated scraping.

---

## 4. Super Intelligence (SI) & AI Disclosure

In accordance with the **NASA Space Apps Challenge Generative AI Policy**, Team Vetris transparently discloses the use of artificial intelligence in this submission:

- **Code Acceleration & Scaffolding:** Generative models were utilized to scaffold UI layouts, GSAP animation hooks, and boilerplate API routes.
- **RAG Telemetry Synthesis:** The SuperIntelligence Chat engine uses Google Gemini (`gemini-3.8-flash` / `gemini-2.5-flash`) strictly as a grounded synthesizer. All returned facts, flame spread rates, and extinction equations are derived from documents retrieved by Qdrant and re-ranked by `Qwen3-Reranker-0.6B`. Hallucinations are actively suppressed by enforcing strict citation attribution.

---

## 5. Local Setup & Quickstart Guide

### Prerequisites
- **Python:** 3.11+ or 3.12+
- **Node.js:** 18.x+ or 20.x+
- **Git:** Installed and on system PATH

### 1. Clone the Repository
```bash
git clone https://github.com/VIVEKVRON/flame-in-freefall.git
cd flame-in-freefall
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Open .env and add your GEMINI_API_KEY from Google AI Studio:
# GEMINI_API_KEY=your_actual_key_here

# Start the Flask API server
python run.py
```
*The backend API will be live on `http://localhost:5000`.*  
*Verify with: `curl http://localhost:5000/api/health`*

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend

# Install Node dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Default NEXT_PUBLIC_API_URL=http://localhost:5000 is configured for local development.

# Start Next.js development server
npm run dev
```
*Open your browser and navigate to `http://localhost:3000`.*

---

## 6. Cloud Deployment Architecture

The application is architected for zero-friction cloud deployment:

- **Backend (Render):** Managed via `render.yaml` Blueprint as a Python Web Service. Gunicorn runs with `--workers 1 --threads 4 --timeout 180` to safely read the persistent local Qdrant store while allocating enough time for Qwen3 reranker loading.
- **Frontend (Vercel):** Deployed with Root Directory configured to `frontend`, passing `NEXT_PUBLIC_API_URL` to connect to the live Render backend.

---

## 7. License

This project is licensed under the **MIT License** - see the [LICENSE](file:///d:/Documents/flame-in-freefall/LICENSE) file for details.

---

**NASA Space Apps Challenge 2026** | *Team Vetris — Vivek V Ron*
