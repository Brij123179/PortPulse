"""
PortPulse Supabase RAG Knowledge Base & Groq LLM Engine.

Combines:
1. Supabase PostgreSQL Vector/Knowledge Base (`portpulse_rag_documents`)
   containing authoritative maritime data from World Port Index (NGA Pub 150),
   BIMCO demurrage standards, and IMO UKC safety resolutions.
2. Ultra-fast Groq LLM Inference API (`openai/gpt-oss-120b`) using the provided API key.
3. Live SQLite telemetry (vessel schedules, berth occupancies, crane breakdowns, solver recommendations).
4. Mechanical anti-hallucination validation and prompt-injection defense.
"""

import os
import re
import json
try:
    import psycopg2
except ImportError:
    psycopg2 = None
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from app.core.logging import logger
from app.services.sanitizer import sanitize_ai_response

try:
    from dotenv import load_dotenv
    # Search for .env in current, backend, or project root directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):
        env_candidate = os.path.join(base_dir, ".env")
        if os.path.exists(env_candidate):
            load_dotenv(env_candidate)
            break
        parent = os.path.dirname(base_dir)
        if parent == base_dir:
            break
        base_dir = parent
except ImportError:
    pass

SUPABASE_HOST = os.getenv("SUPABASE_HOST", "aws-0-ap-southeast-2.pooler.supabase.com")
SUPABASE_PORT = int(os.getenv("SUPABASE_PORT", "6543"))
SUPABASE_USER = os.getenv("SUPABASE_USER", "postgres.oblectpxtfsdelyjoipo")
SUPABASE_PASS = os.getenv("SUPABASE_PASS", "")
SUPABASE_DB = os.getenv("SUPABASE_DB", "postgres")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS = [
    "deepseek/deepseek-v4-flash-0731:free",
    "nex-agi/nex-n2.5-mini:free",
    "qwen/qwen3.8-27b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
]

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Static Fallback in case of temporary network outage
FALLBACK_DOCS = [
    {
        "doc_id": "WPI-NGA-BERTH-SPECS",
        "title": "World Port Index (NGA Pub 150): Deepwater Berth Constraints",
        "source": "NGA Pub 150 World Port Index",
        "content": "ULCVs require >= 16.0m chart datum depth. Feeder berths accommodate 10.5m-13.5m. Tidal events reduce draft by 1.0-2.5m."
    },
    {
        "doc_id": "BIMCO-DEMURRAGE-RATES",
        "title": "BIMCO Commercial Laytime & Container Demurrage Guidelines",
        "source": "BIMCO Standard Charterparty Clauses",
        "content": "Standard demurrage: Feeder $25k/day ($1,040/h), Panamax $35k/day ($1,458/h), Post-Panamax $48k/day ($2,000/h), ULCV $75k/day ($3,125/h)."
    },
    {
        "doc_id": "IMO-UKC-SAFETY-PROTOCOL",
        "title": "IMO Navigation Safety Standards: Dynamic Under-Keel Clearance",
        "source": "IMO Safety Resolution A.893(21)",
        "content": "Minimum dynamic UKC is 1.0m in fairway channels and 0.5m alongside berths. Squat effect increases draft by up to 0.8m."
    },
    {
        "doc_id": "IMO-SLOW-STEAMING-CO2",
        "title": "Green Maritime Logistics: Cubic Law & CO2 Abatement",
        "source": "IMO Fourth GHG Study & World Shipping Council",
        "content": "Fuel consumption follows cubic power law: Fuel Burn = k * v^3. 1 MT of VLSFO fuel saved eliminates exactly 3.114 MT of CO2."
    }
]


class SupabaseRAGEngine:
    """
    RAG service that fetches authoritative maritime documents from Supabase
    and synthesizes responses using Groq's high-speed LLM.
    """

    @classmethod
    def query_supabase_knowledge(cls, user_query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Retrieve relevant maritime reference documents from Supabase PostgreSQL."""
        tokens = [w.lower() for w in re.findall(r"\b\w{4,}\b", user_query)]
        if not tokens:
            tokens = ["berth", "vessel", "crane"]

        if psycopg2 is not None:
            try:
                conn = psycopg2.connect(
                    host=SUPABASE_HOST,
                    port=SUPABASE_PORT,
                    user=SUPABASE_USER,
                    password=SUPABASE_PASS,
                    dbname=SUPABASE_DB,
                    connect_timeout=3
                )
                cur = conn.cursor()

                # Query matching keywords or title
                cur.execute("""
                    SELECT doc_id, title, category, source, content
                    FROM portpulse_rag_documents
                    WHERE keywords && %s OR title ILIKE %s OR content ILIKE %s
                    LIMIT %s;
                """, (tokens, f"%{tokens[0]}%", f"%{tokens[0]}%", limit))

                rows = cur.fetchall()
                cur.close()
                conn.close()

                if rows:
                    return [
                        {
                            "doc_id": r[0],
                            "title": r[1],
                            "category": r[2],
                            "source": r[3],
                            "content": r[4]
                        }
                        for r in rows
                    ]
            except Exception as e:
                logger.warning(f"Supabase RAG query failed ({e}), using cached fallback reference documents.")

        # Fallback keyword match
        matched = []
        for d in FALLBACK_DOCS:
            if any(t in d["content"].lower() or t in d["title"].lower() for t in tokens):
                matched.append(d)
        return matched if matched else FALLBACK_DOCS[:2]

    @classmethod
    def generate_ai_response(
        cls,
        user_query: str,
        live_context: Dict[str, Any],
        retrieved_docs: List[Dict[str, Any]]
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Call OpenRouter high-speed LLM (with fallback cascade and Groq secondary)
        grounded on combined live context and Supabase RAG references.
        Returns (answer_text, model_name).
        Enforces clean text without markdown asterisks or hashes.
        """
        sources_text = "\n\n".join([
            f"--- Document: {d['title']} ({d.get('source', 'Standard')}) ---\n{d.get('content', '')}"
            for d in retrieved_docs
        ])

        system_instruction = (
            "You are PortPulse AI, an intelligent, real-time operational copilot for terminal dispatchers, "
            "harbormasters, and shift supervisors at the Port of Los Angeles (Pier 400).\n\n"
            "You have access to live port operational telemetry (vessel schedules, berth occupancies, "
            "crane breakdowns, delay predictions, and prescriptive solver recommendations) and Supabase "
            "maritime regulations (World Port Index NGA Pub 150, BIMCO demurrage standards, IMO UKC protocols).\n\n"
            "STRICT FORMATTING REQUIREMENTS:\n"
            "- Do NOT use asterisks (*) or hash symbols (#) anywhere in your response.\n"
            "- Do NOT use markdown bold (no **text**) and do NOT use markdown headers (no #, ##, ###).\n"
            "- Write section headers in plain UPPERCASE on their own line (e.g. QUAYSIDE CONGESTION ASSESSMENT).\n"
            "- Use bullet points starting with the unicode character '• ' for lists.\n"
            "- Answer directly, authoritatively, and concisely with specific numbers, vessel names, and berth IDs.\n"
            "- Do not hallucinate berth or vessel IDs not present in the live telemetry."
        )

        user_content = (
            f"LIVE PORT TELEMETRY STATE:\n"
            f"• Total Tracked Vessels: {live_context.get('total_vessels', 50)}\n"
            f"• Delayed Vessels (ETA slip >= 1.0h): {len(live_context.get('delayed_vessels', []))}\n"
            f"• Top Delayed Vessels: {json.dumps(live_context.get('delayed_vessels', [])[:3])}\n"
            f"• Quayside Cranes: {live_context.get('active_cranes', 20)} active / {live_context.get('total_cranes', 20)} total\n"
            f"• Crane Breakdowns: {json.dumps(live_context.get('crane_breakdowns', []))}\n"
            f"• Prescriptive Recommendations: {len(live_context.get('recommendations', []))} active actions\n"
            f"• Demurrage Savings Potential: ${live_context.get('total_demurrage_saved', 0):,.0f} USD\n"
            f"• CO2 Savings Potential: {live_context.get('total_co2_saved', 0):,.1f} MT\n\n"
            f"SUPABASE MARITIME KNOWLEDGE BASE REFERENCES:\n"
            f"{sources_text}\n\n"
            f"DISPATCHER QUERY:\n{user_query}"
        )

        # 1. Attempt OpenRouter Models Cascade
        if OPENROUTER_API_KEY:
            for model_candidate in OPENROUTER_MODELS:
                payload = {
                    "model": model_candidate,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 700
                }
                try:
                    req_data = json.dumps(payload).encode("utf-8")
                    req = urllib.request.Request(
                        OPENROUTER_URL,
                        data=req_data,
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://portpulse.io",
                            "X-Title": "PortPulse AI Copilot"
                        }
                    )
                    with urllib.request.urlopen(req, timeout=12) as resp:
                        res_json = json.loads(resp.read().decode("utf-8"))
                        choice = res_json.get("choices", [{}])[0]
                        answer = choice.get("message", {}).get("content", "")
                        if answer:
                            answer = sanitize_ai_response(answer)
                            model_display = f"OpenRouter ({model_candidate})"
                            return answer, model_display
                except Exception as e:
                    logger.info(f"OpenRouter candidate '{model_candidate}' failed ({e}), trying next candidate...")

        # 2. Attempt Groq as fallback if configured
        if GROQ_API_KEY:
            try:
                payload = {
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 700
                }
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    GROQ_URL,
                    data=req_data,
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                        "User-Agent": "PortPulse-RAG/1.0"
                    }
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    choice = res_json.get("choices", [{}])[0]
                    answer = choice.get("message", {}).get("content", "")
                    if answer:
                        answer = sanitize_ai_response(answer)
                        return answer, f"Groq ({GROQ_MODEL})"
            except Exception as e:
                logger.warning(f"Groq fallback failed: {e}")

        return None, None

    @classmethod
    def generate_groq_response(
        cls,
        user_query: str,
        live_context: Dict[str, Any],
        retrieved_docs: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Backwards-compatibility shim for generate_ai_response."""
        ans, _ = cls.generate_ai_response(user_query, live_context, retrieved_docs)
        return ans


supabase_rag = SupabaseRAGEngine()
