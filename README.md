# TRACEPOINT

> **AI-Assisted Agent Black Box: Replay & Failure Investigation Platform**  
> *HORIZON 2K26 — Track 01: Agentic AI & Intelligent Automation (Challenge A07)*  
> **Tagline:** *Find the First Divergence. Understand the Failure. Fix It with Evidence.*

---

## 1. Executive Summary

Autonomous AI agents execute complex, multi-step sequences: querying APIs, calling tools, persisting state in memory, and generating user-facing outcomes. When an agent silently fails or produces corrupted results, standard log analyzers overwhelm investigators with cascading downstream errors.

**TRACEPOINT** solves the AI Agent Black Box dilemma. It ingests recorded agent execution traces (`.json` or `.jsonl`), deterministically aligns timelines, pinpoints the **First Observed Divergence**, isolates **Downstream Cascades**, enables **Zero Side-Effect Replay**, and provides an **AI Investigation Assistant** with transparent provider attribution.

### Core Guarantees:
- **Evidence-Grounded Diagnostics:** Hypotheses are strictly labeled as unverified; no claim of root cause is asserted without telemetry evidence.
- **Side-Effect Shield:** Replay operates exclusively on captured telemetry. It never invokes external payment gateways, write APIs, or external code.
- **Provider Transparency:** Full transparency on whether an explanation originates from local Ollama (`Qwen2.5`) or the built-in **Rule-Based Forensic Fallback Engine**.

---

## 2. Project Architecture

```
tracepoint/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py              # FastAPI endpoints (traces, comparisons, replay, AI)
│   │   ├── core/
│   │   │   ├── comparison_engine.py   # Deterministic LCS alignment & divergence detector
│   │   │   ├── replay_engine.py       # Isolated state accumulator & playback
│   │   │   ├── trace_parser.py        # Strict JSON/JSONL parser and schema validator
│   │   │   └── ai_assistant.py        # Ollama interface + Forensic Rule-Based Engine
│   │   ├── db/
│   │   │   ├── database.py            # SQLite schema initialization
│   │   │   └── repository.py          # CRUD operations for traces & investigations
│   │   ├── schemas/
│   │   │   └── trace_schemas.py       # Pydantic models
│   │   └── main.py                    # App entrypoint with CORS & startup auto-seeding
│   ├── sample-data/
│   │   ├── successful_order.json      # Reference golden run
│   │   ├── failed_order.json          # Failing execution (timeout divergence at step 2)
│   │   ├── changed_tool_response.json # Alternative branch run (out-of-stock)
│   │   └── failed_order.jsonl         # Line-delimited trace verification
│   ├── tests/
│   │   └── test_tracepoint.py         # 10 automated pytest suites
│   ├── requirements.txt
│   └── tracepoint.db                  # Local SQLite database
├── frontend/
│   ├── src/
│   │   ├── components/                # Layout, DiffBadge, EventDetailDrawer
│   │   ├── pages/                     # Overview, New, Explorer, Compare, Replay, Findings, Settings
│   │   ├── services/                  # API client
│   │   ├── types/                     # TypeScript models
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
│   └── architecture.md
├── .env.example
└── README.md
```

---

## 3. Standardized Trace Schema

TRACEPOINT ingests JSON arrays, root trace objects, or JSONL records complying with the schema:

```json
{
  "trace_id": "trace_failed_002",
  "agent_name": "shopping_agent",
  "run_id": "run_failed_02",
  "event_id": 2,
  "timestamp": "2026-10-01T10:15:03Z",
  "event_type": "tool_response",
  "step_name": "create_order",
  "tool_name": "order_service",
  "input": {
    "order_id": "ORD-101",
    "customer_id": "CUST-881",
    "items": [{"sku": "SKU-PRO-01", "qty": 1}],
    "payment_ref": "TXN-99812"
  },
  "output": {
    "status": "FAILED",
    "error_code": "ORDER_SVC_TIMEOUT",
    "detail": "Connection to upstream order-service timed out after 3000ms"
  },
  "state_before": {
    "order_stage": "PAYMENT_VERIFIED",
    "payment": "PAID",
    "order_status": "UNCREATED"
  },
  "state_after": {
    "order_stage": "ORDER_CREATION_FAILED",
    "payment": "PAID",
    "order_status": "FAILED"
  },
  "status": "failure",
  "error": "Connection to upstream order-service timed out after 3000ms",
  "duration_ms": 3012
}
```

---

## 4. Quick Start & Execution Commands

### Prerequisites
- Python 3.10+ (Python 3.14 tested and verified)
- Node.js 18+ & npm (Node v22 tested)

### Step 1: Start Backend Engine
In a terminal:
```powershell
cd tracepoint/backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*The backend runs at `http://localhost:8000` and automatically initializes SQLite and seeds benchmark traces.*

### Step 2: Start Frontend Dashboard
In a second terminal:
```powershell
cd tracepoint/frontend
npm install
npm run dev
```
*The dashboard opens at `http://localhost:5173`.*

---

## 5. Automated Pytest Verification

Execute the test suite to verify 10 critical validation points:
```powershell
cd tracepoint/backend
python -m pytest tests -v
```

### Verified Test Cases:
1. `test_parse_json_array`: Verifies JSON array parsing & metadata derivation.
2. `test_parse_jsonl`: Verifies line-delimited JSON streaming & error counters.
3. `test_invalid_schema_handling`: Graceful handling of malformed and empty files.
4. `test_exact_trace_match`: Confirms 0 false-positive divergences on identical runs.
5. `test_tool_response_divergence_and_downstream`: Detects first divergence and downstream cascades.
6. `test_missing_and_extra_events`: LCS alignment when events are omitted or inserted.
7. `test_state_difference`: Flags internal state mutations without shifting steps.
8. `test_replay_isolation_and_no_side_effects`: Confirms zero external calls and state reconstruction.
9. `test_rule_based_ai_fallback_explanation`: Evidence citation and hypothesis generation.
10. `test_report_generation`: Full investigation report compilation and limitation auditing.

---

## 6. Main Judge Demonstration Flow

Follow this guided walkthrough during evaluation:

1. **Open the Dashboard (`http://localhost:5173`)**:
   - Observe live metrics loaded directly from SQLite (Traces, Investigations, Divergences).
   - Click **"Launch Live Demo"** or **"Load Benchmark Samples"**.

2. **Side-by-Side Comparison (`/compare`)**:
   - Compare `Trace A (trace_success_001)` vs `Trace B (trace_failed_002)`.
   - **Step #1 (`payment_check`)**: Marked as **MATCH** (both paid $299.99).
   - **Step #2 (`create_order`)**: Prominently flagged as **FIRST OBSERVED DIVERGENCE**. Trace A returned `SUCCESS`, whereas Trace B timed out after 3000ms returning `FAILED`.
   - **Step #3 (`order_status`)** & **Step #4 (`final_output`)**: Marked as **DOWNSTREAM DIFFERENCE**.
   - Click **"View Evidence"** to slide open the raw telemetry and state transitions.

3. **Deterministic Replay Lab (`/replay`)**:
   - Select `trace_failed_002`.
   - Use the scrubber or click **Play Timeline** to watch the agent advance through steps.
   - Inspect the **State Snapshot** panel as internal memory mutates from `CHECKOUT` → `PAYMENT_VERIFIED` → `ORDER_CREATION_FAILED`.
   - Confirm the **Side-Effect Shield** badge verifying zero live external calls.

4. **AI Investigation Findings (`/findings`)**:
   - View the forensic summary and telemetry citations `[1]`, `[2]`.
   - Notice the unverified **Root Cause Hypotheses** and proposed **Remediation**.
   - Test the interactive **Human-In-The-Loop Safe Testing Checklist**.
   - Click **Export JSON** or **Export CSV** to download the comprehensive report.

---

## 7. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/stats` | Forensic metrics & failure distribution |
| `GET` | `/api/traces` | List ingested traces |
| `POST` | `/api/traces/upload` | Upload & validate JSON/JSONL trace file |
| `GET` | `/api/traces/{id}/events`| Retrieve chronological events for a trace |
| `POST` | `/api/comparisons` | Run deterministic trace comparison |
| `GET` | `/api/traces/{id}/replay`| Retrieve state snapshot for step `k` |
| `POST` | `/api/investigations/{id}/explain`| Generate AI or rule-based forensic findings |
| `GET` | `/api/investigations/{id}/report` | Compile complete forensic case report |
| `GET` | `/api/investigations/{id}/export/csv` | Download differences as CSV |
| `POST` | `/api/samples/seed` | Seed built-in benchmark datasets |

---

## 8. Limitations & Forensic Boundary

1. **State Completeness:** Replay fidelity depends on the fields captured in the input trace. If an agent mutates an unrecorded global variable, that mutation cannot be displayed.
2. **Hypotheses vs. Proof:** A changed tool response indicates *where* execution branched, but not *why* the external service timed out or failed. Code review and sandbox simulation are required.
3. **Simulation Boundary:** Replay is deliberately non-executable against live third parties to prevent double charges, duplicate notifications, or state corruption.
