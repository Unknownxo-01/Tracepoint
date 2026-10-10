# TRACEPOINT — Qwen AI Investigation Agent Setup & Verification Guide

## 1. Overview
The **Qwen AI Investigation Agent** is integrated into TRACEPOINT to explain deterministic trace comparison findings, ground diagnoses in captured telemetry facts, cite specific event IDs, propose hypotheses, and provide safe sandbox validation checklists.

---

## 2. Key Architecture & Principles
1. **Detection is Strictly Separate from AI**:
   - The deterministic sequence alignment engine (Needleman-Wunsch / LCS) independently isolates the **First Observed Divergence** and downstream cascades.
   - Qwen receives the aligned trace steps, field discrepancies, tool inputs/outputs, errors, and state mutations as ground truth evidence. Qwen explains the comparison results; it never replaces the comparison engine.
2. **Local Ollama Integration via `/api/chat`**:
   - The FastAPI backend connects to Ollama's structured `/api/chat` endpoint using JSON format mode.
   - The backend reads Ollama URL, model name, and timeout from environment variables.
3. **Transparent Provider Labeling**:
   - When Qwen responds via local Ollama: provider label is **`Qwen (qwen2.5:latest)`** (with green indicator badge).
   - When Ollama or the model is offline/unavailable: provider label is **`Rule-based diagnosis`** (with amber indicator badge). It never falsely claims AI generation when falling back.
4. **Safety & Zero Side Effects**:
   - Trace contents are treated purely as inert JSON telemetry data and never executed as live code.
   - External tool calls are never repeated or re-invoked during diagnosis or replay.
   - No automatic edits to external production code are performed; proposed fixes are delivered with an interactive sandbox validation checklist for the human investigator.

---

## 3. Environment Variables
TRACEPOINT loads configuration from `.env` in the project root or backend directory:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OLLAMA_URL` / `OLLAMA_BASE_URL` | `http://localhost:11434` | The HTTP URL of the local Ollama daemon |
| `OLLAMA_MODEL` / `QWEN_MODEL` | `qwen2.5:latest` | The local model tag to use (e.g., `qwen2.5:latest`, `qwen2.5:7b`, `qwen2.5:14b`) |
| `OLLAMA_TIMEOUT` | `45.0` | Timeout in seconds for LLM generation before falling back to rule-based diagnosis |
| `PREFER_OLLAMA` | `true` | When true, attempts Ollama inference before falling back to rule-based diagnosis |
| `TRACEPOINT_DB_PATH` | `tracepoint.db` | SQLite database file path |
| `PORT` | `8000` | Backend API port |
| `HOST` | `127.0.0.1` | Backend bind host |

Example `.env` file:
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:latest
OLLAMA_TIMEOUT=45.0
PREFER_OLLAMA=true
TRACEPOINT_DB_PATH=tracepoint.db
```

---

## 4. How to Run Qwen Locally with Ollama

### Step 1: Install Ollama
If not already installed, download Ollama for Windows/macOS/Linux from [https://ollama.com](https://ollama.com).

### Step 2: Start Ollama Daemon
Open a terminal and run:
```powershell
ollama serve
```
Verify Ollama is listening by visiting: `http://localhost:11434` (returns `Ollama is running`).

### Step 3: Pull and Test the Qwen Model
Pull the recommended Qwen model:
```powershell
ollama pull qwen2.5:latest
```
*Note: If you have a specific GPU size, you can also use `qwen2.5:7b` or `qwen2.5:3b` and set `OLLAMA_MODEL=qwen2.5:7b` in `.env`.*

Test prompt:
```powershell
ollama run qwen2.5:latest "Hello"
```

---

## 5. How to Start TRACEPOINT

### Backend (FastAPI):
```powershell
cd C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs & Swagger UI: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`
- AI Status: `http://localhost:8000/api/ai/status`

### Frontend (React + Vite):
```powershell
cd C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- Dashboard UI: `http://localhost:5173`

---

## 6. How to Verify That Qwen is Actually Responding

### Verification Method 1: Check the AI Status Endpoint
Query the backend status endpoint:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ai/status"
```
- If Ollama is running and Qwen is installed:
  ```json
  {
    "ollama_available": true,
    "ollama_url": "http://localhost:11434",
    "model_name": "qwen2.5:latest",
    "model_installed": true,
    "available_models": ["qwen2.5:latest"],
    "status_message": "Ollama is running with model 'qwen2.5:latest' ready."
  }
  ```

### Verification Method 2: Check the UI Provider Badge
1. Open `http://localhost:5173` in your browser.
2. Navigate to **Compare Traces** (`/compare`) or click **Investigate Trace** from Overview.
3. Scroll down to the **AI Investigation Assistant** panel.
4. Inspect the badge in the top right header:
   - **Green Badge:** `Qwen (qwen2.5:latest)` indicates local Qwen LLM inference generated the diagnosis.
   - **Amber Badge:** `Rule-based diagnosis` indicates Ollama was offline or timed out, and the deterministic rule engine safely generated the report.

### Verification Method 3: Test via API directly
Send a POST request to generate an explanation for the demo shopping agent:
```powershell
$body = @{ prefer_ollama = $true } | ConvertTo-Json
$res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/investigations/inv_demo_shopping_agent/explain" -Method Post -Body $body -ContentType "application/json"
Write-Host "Provider:" $res.provider_label
Write-Host "Is Fallback:" $res.is_fallback
Write-Host "First Divergence Analysis:" $res.first_divergence_analysis
```

---

## 7. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| Badge says `Rule-based diagnosis` | Ollama daemon is not running | Run `ollama serve` in a terminal |
| `model 'qwen2.5:latest' not found` | The model has not been pulled yet | Run `ollama pull qwen2.5:latest` |
| Ollama request timed out | Model loading / CPU generation exceeded timeout | Increase timeout in `.env`: `OLLAMA_TIMEOUT=90.0` or use smaller model `qwen2.5:3b` |
| Port 8000 or 5173 already in use | Stale background process | Run `Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess \| Stop-Process -Force` |
