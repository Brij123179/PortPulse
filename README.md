# 🚀 PortPulse — Container Congestion Predictor & Port Operations Optimiser

![Validate Submission](https://github.com/diya2405/ibm-hackathon-pcpirates/actions/workflows/validate.yml/badge.svg)

> **IBM BoB AI Hackathon 2026 — Industry Problem Statement L1**
> A predictive digital twin and prescriptive cockpit for maritime container terminals that predicts quayside and anchorage bottlenecks 72 hours in advance and generates constraint-guaranteed optimization advisories.

---

## 👥 Team

| Field | Value |
| :--- | :--- |
| **Team Name** | PCPirates |
| **Track** | Industry Problem Statement L1 |
| **Team Lead** | Naitik Patel — 24it071@charusat.edu.in |
| **Members** | Naitik Patel, Diya Shah, Brij Patel, Rudra Dodiya |

---

### 🚀 Submission Links & Materials
- 🌐 **Live Cloud Cockpit**: [https://portpulse-flame.vercel.app](https://portpulse-flame.vercel.app)
- 🎥 **Video Demonstration**: [Watch on Google Drive](https://drive.google.com/file/d/1BLWRsNu7AvSJW6l2Fcy4yaJqxmv450by/view?usp=drivesdk)
- 📊 **Pitch Deck (Canva)**: [View Interactive Deck](https://canva.link/f7xcddko2qvs3in)
- 📑 **Presentation PDF**: [Port Pulse.pdf](presentation/Port%20Pulse.pdf)

---

### 📸 Application Screenshots Gallery

| 1. Baseline ML Verification | 2. Port Infrastructure & Fleet Master Data |
| :---: | :---: |
| ![Forecast Benchmarks](demo/screenshots/01_forecast_benchmarks.png) | ![Fleet Master Data](demo/screenshots/02_fleet_master_data.png) |

| 3. Enterprise RBAC & Users | 4. Watsonx / RAG Grounded Copilot |
| :---: | :---: |
| ![Personnel RBAC](demo/screenshots/03_personnel_rbac.png) | ![AI Copilot Assistant](demo/screenshots/04_ai_copilot_assistant.png) |

| 5. Operational Activity & Immutable Audit Trail |
| :---: |
| ![Audit Trail](demo/screenshots/05_audit_trail_activity_log.png) |

---

---

## 🎯 Problem Statement

Container port terminals allocate berths, cranes, and yard space manually using spreadsheets and reactive judgment — responding to congestion only *after* vessels are already idling offshore. There is no forward-looking system that fuses vessel schedule data, berth/crane capacity, and historical turnaround patterns into a 72-hour predictive view.

Shift supervisors and terminal managers at container ports bear the direct cost: demurrage penalties of **$1,040–$3,125 per hour** per vessel (BIMCO), wasted bunker fuel, and cascading berth conflicts that compound exponentially once a single mega-ship or crane outage hits.

> See [`docs/problem-statement.md`](docs/problem-statement.md) for the full analysis.

---

## 💡 Solution

PortPulse is a full-stack predictive-prescriptive port operations platform. It corrects carrier ETA bias using an optimized GradientBoosting regressor (**0.88h MAE**, 54.8% improvement over naive baseline), computes hour-by-hour 72-hour berth occupancy probabilities, and runs a HiGHS MILP solver that generates constraint-guaranteed berth and crane schedules with **zero hard constraint violations**.

Operators interact through a zero-scroll cockpit with a live quayside spatial map, 72h Gantt timeline, congestion shock testing lab, and a Groq LLM + Supabase RAG copilot grounded in 6 authoritative maritime standards — turning reactive spreadsheet planning into proactive, AI-verified decision-making.

> See [`docs/solution-overview.md`](docs/solution-overview.md) for architecture detail.

---

## ✨ Key Features

- **Feature 1 — 72h Predictive Congestion Engine**: GradientBoosting ETA corrector + Markov-chain occupancy probability matrix across 10 berths × 72 hours (720 discrete time slots), with calibrated 80% confidence intervals achieving 84.4% empirical coverage.
- **Feature 2 — HiGHS MILP Berth & Crane Optimiser**: Mathematically optimal berth/crane allocation with guaranteed hard constraints (draft, LOA, crane slots, temporal non-overlap). Zero violations in all 8/8 optimizer tests.
- **Feature 3 — Quayside Spatial Harbor Map**: True-to-scale vessel footprints on a continuous coastline, live congestion rings (emerald/amber/pulsing crimson), paginated anchorage basin, and slide-up vessel inspection HUD.
- **Feature 4 — Groq LLM + Supabase RAG Maritime Copilot**: Ultra-low-latency (<150ms) generative AI grounded in 6 maritime regulatory standards with anti-hallucination cross-validation and prompt-injection defense.
- **Feature 5 — Enterprise RBAC, Audit Trails & Feedback Loop**: JWT-secured 4-role access control (Admin/Supervisor/Planner/Manager), immutable append-only audit log with correlation IDs, and operator feedback drift tracker across DIVERSION / SLOW_STEAM / PRIORITY_RESEQUENCE recommendation types.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Languages** | Python 3.12, TypeScript |
| **Frameworks** | FastAPI, React 18, Vite, Tailwind CSS |
| **IBM Technologies** | IBM BoB AI (development), Groq LLM Inference (`openai/gpt-oss-120b`) |
| **Databases** | SQLite (local), Supabase PostgreSQL (RAG vector store) |
| **ML / Optimisation** | scikit-learn GradientBoosting, SciPy HiGHS MILP solver, Markov occupancy matrix |
| **Other** | GitHub Actions, JWT, bcrypt, pytest (63 tests), Vercel, Render |

---

## 📁 Repository Structure

```
├── data/                       # Ground-truth datasets & reference benchmarks
│   ├── historical_turnaround_dataset.csv  # 3,500+ turnaround records
│   └── derived/                # Calibrated carrier biases, dwells, & port specs
├── scripts/                    # Offline training and preparation utilities
│   ├── train_model.py          # Dedicated ML training & cross-validation pipeline
│   ├── prepare_reference_data.py # Reference distribution generator (25 carriers)
│   └── seed_supabase_rag.py    # Supabase vector store seeding
├── src/                        # All source code
│   ├── backend/                # FastAPI Python backend
│   │   ├── app/                # Routers, services, models, schemas
│   │   ├── tests/              # 63 automated tests (pytest)
│   │   └── requirements.txt
│   └── frontend/               # React + TypeScript + Vite cockpit
│       └── src/components/     # All UI components
├── docs/                       # Written documentation
├── demo/                       # Demo artifacts
├── presentation/               # Slide deck
├── submission.yaml             # Structured submission metadata
└── README.md
```

---

## ⚡ How to Run

```bash
# 1. Clone the repo
git clone https://github.com/Brij123179/PortPulse.git
cd PortPulse

# 2. Backend — install dependencies
cd src/backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt

# 3. Model Training & Offline Calibration (Optional — pre-trained model included)
python ../../scripts/prepare_reference_data.py
python ../../scripts/train_model.py

# 4. Configure environment
cp src/.env.example src/.env
# Edit src/.env with your Supabase and Groq credentials (optional — runs fully on SQLite without them)

# 5. Run the backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 6. Run the frontend (new terminal)
cd src/frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** — log in with any demo profile below.

| Role | Username | Password |
| :--- | :--- | :--- |
| 🛡️ Administrator | `admin` | `admin123` |
| ⚓ Shift Supervisor | `supervisor` | `super123` |
| 📊 Vessel Planner | `planner` | `plan123` |
| 🏢 Terminal Manager | `manager` | `manage123` |

> Full step-by-step instructions: [`docs/setup-guide.md`](docs/setup-guide.md)

---

## 🖥️ Demo

| Artifact | Link |
| :--- | :--- |
| 📹 Demo Video | See [`demo/demo-video-link.txt`](demo/demo-video-link.txt) |
| 🌐 Live Demo | See [`demo/live-demo-url.txt`](demo/live-demo-url.txt) |
| 🖼️ Screenshots | See [`demo/screenshots/`](demo/screenshots/) |
| 📊 Presentation | See [`presentation/`](presentation/) |

---

## 🧪 Automated Tests

```bash
cd src/backend
pytest -v
# 48 passed in 6.02s — covers auth, RBAC, forecast, optimiser, audit, ingestion, CSV, E2E
```

---

## ⚠️ Known Limitations

- **Synthetic data only**: The platform uses a synthetic port dataset (50 vessels, 10 berths) — not connected to a live AIS/TOS feed.
- **Local LLM credentials required for RAG copilot**: The Groq API key and Supabase credentials in `.env` are required for the AI chat and shift briefing features; all other features run fully offline on SQLite.
- **Single-node SQLite**: Designed for hackathon evaluation on a single machine; production path uses PostgreSQL on OpenShift as documented in `docs/architecture.md`.

---

## 🏅 What We're Most Proud Of

The **end-to-end integration** of four AI disciplines in a single coherent product: predictive ML (ETA correction + 72h occupancy), prescriptive MILP optimisation (zero hard constraint violations), generative AI (RAG copilot grounded in real maritime standards), and governance (immutable audit trail + operator feedback drift detection) — all running on a single Intel i3/8GB RAM machine with 48 passing automated tests. The quayside spatial map renders a true-to-scale physical harbor with live congestion semantics that a real shift supervisor could interpret and act on immediately.

---

## 🏆 Incremental Delivery Scorecard

| Increment | Scope | Status |
| :--- | :--- | :---: |
| **I1 — Data Foundation** | Synthetic pipeline, master data CRUD, live status table, JWT RBAC | ✅ Complete |
| **I2 — Prediction Core** | ETA corrector (1.17h MAE), 72h occupancy matrix, risk heatmap, SHAP explainability | ✅ Complete |
| **I3 — Recommend & Optimise** | Diversions, slow-steam advisories, HiGHS MILP solver, What-If sandbox | ✅ Complete |
| **I4 — Generative Cockpit** | Groq RAG copilot, AI shift briefing, 72h Gantt, unified cockpit | ✅ Complete |
| **I5 — Platform & Trust** | Immutable audit trail, feedback loop tracker, shock scenario lab | ✅ Complete |
