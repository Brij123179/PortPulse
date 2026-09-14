# PortPulse — Production Cloud Deployment Guide

**Container Congestion Predictor & Port Operations Optimiser (Problem Statement L1)**  
**Target Infrastructure:** Render (Python / FastAPI Backend) + Vercel (React / TypeScript / Vite Frontend) + Supabase (PostgreSQL RAG) + Groq (LLM Inference)

---

## Architecture Overview

```
[ Browser / Users ]
        │
        ├──► Vercel Edge CDN (Frontend React SPA)
        │         │ (API calls via VITE_API_URL or rewrite proxy)
        │         ▼
        └──► Render Cloud (FastAPI Backend + ML Inference)
                  │
                  ├──► SQLite / PostgreSQL (Vessel Schedules & Berth Master Data)
                  ├──► Groq API ('openai/gpt-oss-120b' LLM Inference)
                  └──► Supabase Cloud ('portpulse_rag_documents' Maritime RAG)
```

---

## 1. Backend Deployment on Render

### Option A: 1-Click Render Blueprint (Recommended)
1. Fork or push this repository to your GitHub account (`diya2405/ibm-hackathon-pcpirates`).
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml` and configure the `portpulse-backend` service.
6. Under **Environment Variables**, fill in your secret keys:
   - `SUPABASE_HOST`: `aws-0-ap-southeast-2.pooler.supabase.com`
   - `SUPABASE_PORT`: `6543`
   - `SUPABASE_USER`: `postgres.oblectpxtfsdelyjoipo`
   - `SUPABASE_PASS`: `<your_supabase_password>`
   - `SUPABASE_DB`: `postgres`
   - `GROQ_API_KEY`: `<your_groq_api_key>`
   - `GROQ_MODEL`: `openai/gpt-oss-120b`
7. Click **Apply**. Render will install dependencies and launch Uvicorn automatically.
8. Your backend URL will be: `https://portpulse-backend.onrender.com`.

### Option B: Manual Web Service Setup on Render
1. Click **New +** -> **Web Service**.
2. Connect your repo.
3. Configure settings:
   - **Name:** `portpulse-backend`
   - **Root Directory:** *(leave blank or `src/backend`)*
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r src/backend/requirements.txt`
   - **Start Command:** `cd src/backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add Environment Variables:
   - `PORTPULSE_ENV`: `production`
   - `PORTPULSE_CORS_ORIGINS`: `https://*.vercel.app,http://localhost:5173,http://127.0.0.1:5173`
   - `PORTPULSE_SECRET_KEY`: `<generate a random 32+ char string>`
   - Supabase & Groq credentials as listed above.
5. Click **Create Web Service**.

> [!NOTE]
> On the very first startup, PortPulse automatically detects an empty database, runs database migrations, creates the 4 default operator accounts (`admin`, `supervisor`, `planner`, `manager`), seeds 10 berths and 50 vessels, and fits the ML models in under 5 seconds!

---

## 2. Frontend Deployment on Vercel

### Step-by-Step Vercel Setup
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`diya2405/ibm-hackathon-pcpirates`).
4. In the configuration screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `src/frontend` (or leave root as `.` if using root `vercel.json`).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Expand **Environment Variables** and add:
   - `VITE_API_URL`: `https://portpulse-backend.onrender.com` *(your Render backend URL)*
6. Click **Deploy**.
7. Vercel will build and deploy your application to `https://<your-project>.vercel.app`.

---

## 3. Seed Supabase Maritime RAG Database (One-Time Setup)

To populate the cloud Supabase PostgreSQL instance with the 6 maritime reference documents:
```bash
# Ensure .env has SUPABASE_HOST, SUPABASE_USER, SUPABASE_PASS
python scripts/seed_supabase_rag.py
```
Output:
```
[*] Connecting to Supabase PostgreSQL at aws-0-ap-southeast-2.pooler.supabase.com:6543...
[*] Creating table 'portpulse_rag_documents' if not exists...
[*] Upserting 6 authoritative maritime reference documents into Supabase...
[SUCCESS] Supabase Knowledge Base populated! Total Documents in Supabase: 6
```

---

## 4. Default Operator Profiles for Testing

| Role | Username | Default Password | Permissions & System Scope |
| :--- | :--- | :--- | :--- |
| 🛡️ **Administrator** | `admin` | `admin123` | Master infrastructure CRUD, provision new operators, override guardrails, system settings. |
| ⚓ **Shift Supervisor** | `supervisor` | `super123` | Quayside dispatch, approve/reject recommendations, generate AI shift handover briefing. |
| 📊 **Vessel Planner** | `planner` | `plan123` | ETA predictions, berth allocation, What-If simulation sandbox. |
| 🏢 **Terminal Manager** | `manager` | `manage123` | Executive KPI dashboard, demurrage & CO2 decarbonization analytics, audit governance. |

---

## 5. Verification Checklist After Deployment

1. Open `https://<your-project>.vercel.app`.
2. Verify the **Login Page** loads with the 4 Quick Demo Login buttons.
3. Click **"Sign In as Supervisor"** — verify immediate access to the live quayside cockpit.
4. Click **"Ask AI"** in the top navbar and submit: *"Which berths are at risk tomorrow?"*
   - Verify fast response (< 150ms) generated by Groq LLM with citations from Supabase.
5. Click **"Sign Out"** — verify return to Login Page.
6. Sign in as `admin` (`admin` / `admin123`) and verify access to the User Management tab to provision new operators.
