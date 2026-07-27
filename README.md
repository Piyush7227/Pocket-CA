# Pocket C.A. — AI Chartered Accountant Assistant

Pocket C.A. is an intelligent AI financial assistant designed to help users with basic accounting, taxation, and financial management queries. Built with Python Flask, Google Gemini LLM (`google-genai` SDK), and Server-Sent Events (SSE) streaming.

---

## 🌟 Key Features

- **Double-Entry Journal Entries**: Properly formatted accounting tables with Debit/Credit columns and account names.
- **GST & Taxation**: Direct & Indirect tax calculations, Input Tax Credit, CGST/SGST/IGST breakdown, and regime comparison (Old vs. New).
- **Financial Statements**: Profit & Loss Statements, Balance Sheets (Schedule III format), and Cash Flow analysis.
- **Depreciation & Ratios**: Straight Line Method (SLM), Written Down Value (WDV), and key financial ratio interpretations.
- **SSE Real-Time Streaming**: Low-latency token-by-token streaming using Server-Sent Events.
- **Automatic Fallback Chain**: Resilient model selection (`gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite`) handling rate limits gracefully.
- **Dynamic Suggestion Cards**: Randomised topic starter cards generated on every page refresh.
- **No Vibe-Coding Aesthetic**: Custom dark navy-charcoal design system, DM Serif typography, and monospace ledger tables.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, Flask, Gunicorn
- **AI SDK**: `google-genai` (Google Gemini API)
- **Frontend**: Vanilla HTML5, CSS3 (Design Tokens), JavaScript (ES6+), `marked.js`
- **Streaming**: Server-Sent Events (SSE) via `fetch()` ReadableStream

---

## 🚀 Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Piyush7227/Pocket-CA.git
   cd Pocket-CA
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**:

   Create a `.env` file in the root directory:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   SECRET_KEY=your_secret_key
   ```

   *(Get your free key from [Google AI Studio](https://aistudio.google.com/apikey))*

4. **Run the application**:

   ```bash
   python app.py
   ```

   Open `http://127.0.0.1:5000` in your browser.

---

## ☁️ Deployment (Render)

This project includes a `Procfile` and `render.yaml` pre-configured for **Render**:

1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Create a new **Web Service** or **Blueprint**.
3. Connect repository `Piyush7227/Pocket-CA`.
4. Set Environment Variable `GEMINI_API_KEY` = `your_api_key`.
5. Deploy!

---

## 👥 Group Members

| Member | Name | Registration Number |
|:------:|------|:-------------------:|
| 1 | **Piyush Kumar Singh** | **12401851** |
| 2 | **Aditya Aranedath** | **12406143** |

---

## ⚖️ Disclaimer

*Pocket C.A. is created for educational and informational purposes. For official tax filings, statutory audits, and legal financial advice, please consult a licensed Chartered Accountant.*
