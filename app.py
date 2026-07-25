import os
import json
import uuid
from flask import Flask, request, jsonify, session, render_template, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "pocket-ca-secret-2024")
CORS(app, supports_credentials=True)

# ── Model fallback chain ────────────────────────────────────
# Confirmed available on this API key via client.models.list()
MODEL_CHAIN = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]

# ── System prompt ───────────────────────────────────────────
SYSTEM_PROMPT = """You are Pocket C.A. — a professional AI Chartered Accountant assistant specialising in Indian accounting, taxation, and financial management.

## Your Expertise Covers:
- **Journal Entries**: Always present in a properly formatted double-entry table with Debit and Credit columns
- **Ledger Accounts & Trial Balance**: Use structured table format
- **Financial Statements**: P&L Statement, Balance Sheet, Cash Flow Statement — formatted as tables
- **GST**: Input Tax Credit, GSTR filings, GST calculations, composition scheme, reverse charge
- **Income Tax**: ITR filing, deductions (80C, 80D, 80G, HRA, LTA), tax slabs (old & new regime)
- **TDS/TCS**: Rates, provisions, Form 16, 26AS reconciliation
- **Depreciation**: SLM, WDV methods with year-wise schedules
- **Financial Ratios**: Liquidity, profitability, solvency, efficiency ratios with interpretation
- **Budgeting & Forecasting**: Variance analysis, budget preparation
- **Cost Accounting**: Job costing, process costing, marginal costing, break-even analysis
- **Audit & Compliance**: Statutory requirements, ROC filings, company law basics

## Formatting Rules:
1. For journal entries, ALWAYS use this exact table format:
   | Date | Particulars | L.F. | Debit (₹) | Credit (₹) |
   |------|-------------|------|-----------|------------|
2. For financial statements, use clear, structured tables with totals
3. Use ₹ symbol for all Indian currency amounts
4. When showing calculations, show step-by-step working
5. Use **bold** for account names and key terms
6. For tax calculations, always state the applicable section/rule
7. End complex responses with a brief "Key Takeaway" summary

## Tone & Behaviour:
- Be precise, professional, and educational
- If the query involves complex tax planning or litigation, add: "⚠️ For official filings and legal matters, please consult a licensed Chartered Accountant."
- For ambiguous queries, ask a clarifying question before answering
- Never fabricate tax rates or legal provisions — if unsure, say so clearly
- Default currency: Indian Rupee (₹)
- Default tax year context: Current Indian financial year

You are NOT a general chatbot. Politely redirect off-topic queries back to accounting and finance."""

# ── In-memory conversation store ────────────────────────────
conversations: dict[str, list] = {}


def get_client() -> genai.Client:
    """Return a configured Gemini client (reads key fresh each call)."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def build_contents(history: list, user_message: str) -> list:
    """Build a types.Content list from stored history + new user message."""
    contents = []
    for turn in history:
        contents.append(
            types.Content(
                role=turn["role"],
                parts=[types.Part(text=p) for p in turn["parts"]],
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=user_message)],
        )
    )
    return contents


def generate_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.8,
        top_p=0.95,
        max_output_tokens=8192,
    )


def sse(payload: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ── Routes ──────────────────────────────────────────────────

@app.route("/")
def index():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    return render_template("index.html")


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    """SSE streaming chat endpoint with model fallback chain."""
    data = request.get_json(silent=True)
    if not data or not data.get("message", "").strip():
        return jsonify({"error": "No message provided"}), 400

    user_message = data["message"].strip()
    session_id = session.get("session_id", str(uuid.uuid4()))

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        def no_key():
            yield sse({"error": "GEMINI_API_KEY is not configured."})
        return Response(stream_with_context(no_key()),
                        mimetype="text/event-stream")

    # Build conversation contents
    history = conversations.setdefault(session_id, [])
    contents = build_contents(history, user_message)

    @stream_with_context
    def generate():
        client = get_client()
        full_reply = ""
        last_error = ""

        for model_id in MODEL_CHAIN:
            try:
                stream = client.models.generate_content_stream(
                    model=model_id,
                    contents=contents,
                    config=generate_config(),
                )
                for chunk in stream:
                    if chunk.text:
                        full_reply += chunk.text
                        yield sse({"chunk": chunk.text})

                # Success — persist history
                history.append({"role": "user",   "parts": [user_message]})
                history.append({"role": "model",  "parts": [full_reply]})

                # Keep last 40 turns
                if len(history) > 40:
                    conversations[session_id] = history[-40:]

                yield sse({"done": True, "model": model_id})
                return

            except Exception as e:
                err = str(e)
                # 429 (quota) or 404 (model not found) → try next model
                if "429" in err or "quota" in err.lower() or "404" in err or "not found" in err.lower():
                    last_error = err
                    continue
                # Any other error — report immediately
                yield sse({"error": f"Error: {err}"})
                return

        # All models exhausted
        yield sse({"error": f"All models quota-exhausted or unavailable. Last error: {last_error}"})

    return Response(generate(), mimetype="text/event-stream",
                    headers={"X-Accel-Buffering": "no",
                             "Cache-Control": "no-cache"})


@app.route("/api/session/clear", methods=["POST"])
def session_clear():
    session_id = session.get("session_id")
    if session_id:
        conversations.pop(session_id, None)
    return jsonify({"status": "cleared"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "api_configured": bool(os.environ.get("GEMINI_API_KEY", "")),
        "model_chain": MODEL_CHAIN,
    })


@app.route("/api/models", methods=["GET"])
def models():
    """List models from both config and live Gemini API."""
    live = []
    error = None
    try:
        client = get_client()
        for m in client.models.list():
            if "generateContent" in (m.supported_actions or []):
                live.append(m.name)
    except Exception as e:
        error = str(e)
    return jsonify({
        "configured_chain": MODEL_CHAIN,
        "live_available": live,
        "error": error,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

