# Setup & Reproduction Guide — PortPulse

This guide provides step-by-step instructions to run PortPulse locally on an **Intel i3, 8GB RAM** development machine.

---

## Prerequisites
- **Python**: 3.10 to 3.12 (Tested on Python 3.12.7)
- **Node.js**: v18+ (Tested on Node v22.20.0, npm 10.9.3)
- **Git**: Installed
- **OS**: Windows, macOS, or Linux

---

## 1. Repository Setup & Environment Configuration

1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/diya2405/ibm-hackathon-pcpirates.git
   cd ibm-hackathon-pcpirates
   ```

2. Configure environment variables:
   ```bash
   cp src/.env.example src/.env
   ```
   *(Note: The default values in `.env.example` are preconfigured to run locally with SQLite without needing external cloud credentials for Increment 1).*

---

## 2. Backend Setup (FastAPI + SQLite)

1. Navigate to the backend directory:
   ```bash
   cd src/backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. Install required dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Initialize database and seed initial synthetic data (50 vessels, 10 berths):
   ```bash
   python -m app.services.seed
   ```

5. Run backend server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   - Interactive Swagger API Docs: `http://127.0.0.1:8000/docs`
   - ReDoc: `http://127.0.0.1:8000/redoc`

---

## 3. Frontend Setup (React + Vite)

1. Open a separate terminal window and navigate to the frontend directory:
   ```bash
   cd src/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   - Access the supervisor cockpit at: `http://localhost:5173`

---

## 4. Running Automated Tests

To conserve system memory, run backend and frontend test suites sequentially rather than concurrently:

1. **Backend Tests:**
   ```bash
   cd src/backend
   pytest -v
   ```

2. **Frontend Tests:**
   ```bash
   cd src/frontend
   npm test
   ```
