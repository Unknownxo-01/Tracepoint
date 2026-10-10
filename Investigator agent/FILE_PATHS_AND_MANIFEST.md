# TRACEPOINT — Investigator Agent File Inventory & Path Manifest

This document records all project files, their exact absolute paths on this system, their relative paths, and their specific architectural roles within the TRACEPOINT AI-Assisted Agent Black Box Investigation platform.

---

## 1. System Environment & Root Directories

| Parameter | Location / Value |
|---|---|
| **Operating System** | Windows |
| **Project Root Directory** | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint` |
| **Investigator Agent Folder** | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\Investigator agent` |
| **Backend Root** | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend` |
| **Frontend Root** | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend` |
| **Database Path** | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\tracepoint.db` |
| **Artifacts Directory** | `C:\Users\MUKESH\.gemini\antigravity-ide\brain\45e14308-5976-4e87-bfe9-37ded8814f9a` |

---

## 2. Complete File Paths Table

### Backend Core & Engine (`tracepoint/backend/app/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 1 | `main.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\main.py` | FastAPI application entrypoint with lifecycle manager, CORS middleware, and automatic startup database seeding. |
| 2 | `routes.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\api\routes.py` | All REST API endpoints for investigations, traces, comparisons, replay simulation, AI diagnostics, and CSV report export. |
| 3 | `comparison_engine.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\core\comparison_engine.py` | Deterministic Needleman-Wunsch / LCS sequence alignment engine that detects First Observed Divergence and classifies downstream cascades. |
| 4 | `replay_engine.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\core\replay_engine.py` | Deterministic replay simulator reconstructing progressive state accumulation with zero external side effects. |
| 5 | `trace_parser.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\core\trace_parser.py` | Trace ingestion engine parsing JSON arrays, root trace objects, and line-delimited JSONL files with strict schema validation. |
| 6 | `ai_assistant.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\core\ai_assistant.py` | AI Investigation Assistant supporting local Ollama (`Qwen2.5`) with transparent attribution to the built-in Forensic Rule-Based Engine. |
| 7 | `trace_schemas.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\schemas\trace_schemas.py` | Pydantic data models for `TraceEvent`, `TraceMetadata`, `ComparisonResult`, `AlignedStep`, `AIExplanation`, and `InvestigationReport`. |
| 8 | `database.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\db\database.py` | SQLite database initialization, table creation (`traces`, `investigations`, `comparisons`, `explanations`), and connection factory. |
| 9 | `repository.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\app\db\repository.py` | Data access layer providing persistent CRUD operations for investigations, traces, comparisons, and AI findings. |

### Sample Benchmark Datasets (`tracepoint/backend/sample-data/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 10 | `successful_order.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\sample-data\successful_order.json` | Benchmark Golden Run trace where all checkout, payment, order creation, and fulfillment steps succeed. |
| 11 | `failed_order.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\sample-data\failed_order.json` | Benchmark Failing Run trace where step #2 (`create_order`) times out and cascades into `NOT_FOUND` errors. |
| 12 | `changed_tool_response.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\sample-data\changed_tool_response.json` | Benchmark Alternative Branch trace where inventory audit returns out-of-stock and gracefully refunds payment. |
| 13 | `failed_order.jsonl` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\sample-data\failed_order.jsonl` | Line-delimited JSON format of the failing trace verifying JSONL ingestion. |

### Backend Tests & Configs (`tracepoint/backend/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 14 | `test_tracepoint.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\tests\test_tracepoint.py` | Automated Pytest suite with 10 unit and integration tests covering parsing, alignment, replay safety, AI fallback, and reports. |
| 15 | `requirements.txt` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\requirements.txt` | Python package dependencies (`fastapi`, `uvicorn`, `pydantic`, `httpx`, `python-multipart`, `pytest`). |
| 16 | `tracepoint.db` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\backend\tracepoint.db` | Persistent SQLite database storing trace telemetry and investigation cases. |

### Frontend UI Components & Pages (`tracepoint/frontend/src/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 17 | `App.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\App.tsx` | Root React component managing navigation, active investigation selection, and demo loading. |
| 18 | `main.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\main.tsx` | React DOM root mounting script. |
| 19 | `index.css` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\index.css` | Global styles, Tailwind directives, and forensic scrollbar configurations. |
| 20 | `api.ts` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\services\api.ts` | Frontend API client communicating with FastAPI endpoints. |
| 21 | `index.ts` (types) | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\types\index.ts` | TypeScript data contract definitions matching backend schemas. |
| 22 | `Layout.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\components\Layout.tsx` | Dashboard shell with forensic sidebar, case switcher, backend health badge, and quick demo button. |
| 23 | `DiffBadge.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\components\DiffBadge.tsx` | Visual badges for `MATCH`, `FIRST_DIVERGENCE`, `DOWNSTREAM_DIFFERENCE`, and `UNMATCHED`. |
| 24 | `EventDetailDrawer.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\components\EventDetailDrawer.tsx` | Slide-over inspector panel displaying raw inputs, outputs, state transitions, and error logs with JSON copy. |
| 25 | `AIAssistantWorkspace.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\components\AIAssistantWorkspace.tsx` | Primary AI Assistant workspace embedded in Compare Traces with forensic diagnostics, evidence citation, and grounded Q&A chat. |
| 26 | `EventExplanationModal.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\components\EventExplanationModal.tsx` | Modal dialog providing dedicated on-demand AI forensic analysis for individual events requested in Trace Explorer. |
| 27 | `OverviewPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\OverviewPage.tsx` | Forensic KPI metrics, AI Investigation Assistant card with direct trace launcher, failure classification chart, and recent cases list. |
| 28 | `NewInvestigationPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\NewInvestigationPage.tsx` | File upload interface with Trace A/B slot assignment and benchmark loader. |
| 29 | `TraceExplorerPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\TraceExplorerPage.tsx` | Single-trace chronological timeline with 'Explain this event' AI action, search, tool filter, status filter, and detail drawer. |
| 30 | `ComparePage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\ComparePage.tsx` | Aligned dual-timeline view highlighting First Observed Divergence, with embedded AI Assistant Workspace panel. |
| 31 | `ReplayLabPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\ReplayLabPage.tsx` | Deterministic replay simulator with scrubber bar, autoplay, progressive state snapshot, and safety shield. |
| 32 | `FindingsPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\FindingsPage.tsx` | AI Investigation Assistant panel with evidence citations, unproven hypotheses, safe test checklist, and JSON/CSV export. |
| 33 | `SettingsPage.tsx` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\src\pages\SettingsPage.tsx` | Ollama connection tester, benchmark re-seeder, and challenge architecture documentation. |

### Frontend Build & Configs (`tracepoint/frontend/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 32 | `index.html` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\index.html` | HTML entrypoint with metadata, Google Fonts (Inter & JetBrains Mono), and forensic favicon. |
| 33 | `package.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\package.json` | Frontend dependencies (`react`, `lucide-react`, `recharts`, `tailwindcss`, `vite`). |
| 34 | `vite.config.ts` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\vite.config.ts` | Vite build tool configuration. |
| 35 | `tailwind.config.js` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\tailwind.config.js` | Tailwind CSS color tokens and typography configuration. |
| 36 | `postcss.config.js` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\postcss.config.js` | PostCSS configuration for Tailwind. |
| 37 | `tsconfig.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\tsconfig.json` | TypeScript root compiler configuration. |
| 38 | `tsconfig.app.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\tsconfig.app.json` | TypeScript application project configuration. |
| 39 | `tsconfig.node.json` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\frontend\tsconfig.node.json` | TypeScript Node tooling configuration. |

### Root Documentation & Verification (`tracepoint/`)

| # | File Name | Absolute File Path | Description |
|---|---|---|---|
| 40 | `README.md` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\README.md` | Comprehensive project guide with architecture, setup, demo walkthrough, test verification, and API reference. |
| 41 | `.env.example` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\.env.example` | Environment variable template for port, database, and Ollama configuration. |
| 42 | `verify_demo.py` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\verify_demo.py` | Automated Python script verifying end-to-end API execution of traces, comparisons, replay, and reports. |
| 43 | `architecture.md` | `C:\Users\MUKESH\.gemini\antigravity-ide\scratch\tracepoint\docs\architecture.md` | Detailed architectural specification for sequence alignment, divergence isolation, and replay safety. |
