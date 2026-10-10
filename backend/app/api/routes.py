import csv
import io
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.core.ai_assistant import AIAssistant
from app.core.comparison_engine import compare_traces
from app.core.replay_engine import ReplayEngine
from app.core.trace_parser import TraceParseError, parse_trace_content
from app.db.repository import Repository
from app.schemas.trace_schemas import (
    AIChatRequest,
    AIChatResponse,
    AIExplanation,
    AIStatusResponse,
    ComparisonRequest,
    ComparisonResult,
    EventExplanation,
    InvestigationCreate,
    InvestigationRecord,
    InvestigationReport,
    ReplayStepResponse,
    TraceEvent,
    TraceMetadata,
    TraceUploadResponse,
)

router = APIRouter(prefix="/api")
ai_assistant = AIAssistant()


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TRACEPOINT Core Engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@router.get("/stats")
def get_stats():
    investigations = Repository.list_investigations()
    traces = Repository.list_traces()

    total_error_events = sum(t.get("error_count", 0) for t in traces)
    total_divergent_comparisons = 0

    # Count comparisons with first divergence
    conn_items = [inv for inv in investigations if inv.comparison_id]
    for inv in conn_items:
        cmp = Repository.get_comparison(inv.comparison_id)
        if cmp and cmp.first_divergence_index is not None:
            total_divergent_comparisons += 1

    return {
        "total_investigations": len(investigations),
        "total_traces": len(traces),
        "divergent_comparisons": total_divergent_comparisons,
        "total_error_events": total_error_events,
        "recent_investigations": [inv.model_dump() for inv in investigations[:5]],
        "failure_categories": [
            {"category": "Timeout / Latency", "count": 1 if total_error_events > 0 else 0},
            {"category": "Downstream 404/Not Found", "count": 1 if total_error_events > 0 else 0},
            {"category": "State Transition Deficit", "count": 1 if total_error_events > 0 else 0},
        ],
    }


# ==================== TRACE ENDPOINTS ====================


@router.get("/traces")
def list_traces():
    return Repository.list_traces()


@router.get("/traces/{trace_id}")
def get_trace(trace_id: str):
    meta = Repository.get_trace_metadata(trace_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found.")
    return meta


@router.get("/traces/{trace_id}/events")
def get_trace_events(trace_id: str):
    events = Repository.get_trace_events(trace_id)
    if events is None:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found.")
    return events


class RawTraceUpload(BaseModel):
    trace_id: Optional[str] = None
    content: str


@router.post("/traces/upload", response_model=TraceUploadResponse)
async def upload_trace_file(
    file: Optional[UploadFile] = File(None),
):
    if not file:
        raise HTTPException(status_code=400, detail="Trace file is required.")

    content_bytes = await file.read()
    raw_text = content_bytes.decode("utf-8", errors="replace")
    filename = file.filename or "uploaded_trace"
    default_id = f"trace_{os.path.splitext(filename)[0]}_{uuid.uuid4().hex[:6]}"

    try:
        events, metadata = parse_trace_content(raw_text, default_trace_id=default_id)
    except TraceParseError as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse trace: {e.message}")

    Repository.save_trace(metadata.trace_id, events, metadata)

    return TraceUploadResponse(
        trace_id=metadata.trace_id,
        agent_name=metadata.agent_name,
        event_count=metadata.event_count,
        message=f"Trace '{metadata.trace_id}' uploaded and validated successfully.",
        metadata=metadata,
    )


@router.post("/traces/upload-raw", response_model=TraceUploadResponse)
def upload_trace_raw(payload: RawTraceUpload):
    default_id = payload.trace_id or f"trace_{uuid.uuid4().hex[:8]}"
    try:
        events, metadata = parse_trace_content(payload.content, default_trace_id=default_id)
    except TraceParseError as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse trace: {e.message}")

    Repository.save_trace(metadata.trace_id, events, metadata)

    return TraceUploadResponse(
        trace_id=metadata.trace_id,
        agent_name=metadata.agent_name,
        event_count=metadata.event_count,
        message=f"Trace '{metadata.trace_id}' parsed and saved.",
        metadata=metadata,
    )


# ==================== INVESTIGATION ENDPOINTS ====================


@router.get("/investigations", response_model=List[InvestigationRecord])
def list_investigations():
    return Repository.list_investigations()


@router.post("/investigations", response_model=InvestigationRecord)
def create_investigation(payload: InvestigationCreate):
    inv_id = f"inv_{uuid.uuid4().hex[:8]}"
    record = Repository.create_investigation(
        inv_id=inv_id,
        name=payload.name,
        description=payload.description,
        trace_a_id=payload.trace_a_id,
        trace_b_id=payload.trace_b_id,
    )
    return record


@router.get("/investigations/{inv_id}", response_model=InvestigationRecord)
def get_investigation(inv_id: str):
    inv = Repository.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation '{inv_id}' not found.")
    return inv


# ==================== COMPARISON ENDPOINTS ====================


@router.post("/comparisons", response_model=ComparisonResult)
def run_comparison(req: ComparisonRequest):
    events_a = Repository.get_trace_events(req.trace_a_id)
    if events_a is None:
        raise HTTPException(status_code=404, detail=f"Trace A '{req.trace_a_id}' not found in database.")

    events_b = Repository.get_trace_events(req.trace_b_id)
    if events_b is None:
        raise HTTPException(status_code=404, detail=f"Trace B '{req.trace_b_id}' not found in database.")

    comparison = compare_traces(
        events_a=events_a,
        events_b=events_b,
        trace_a_id=req.trace_a_id,
        trace_b_id=req.trace_b_id,
    )

    Repository.save_comparison(comparison)

    if req.investigation_id:
        Repository.update_investigation_comparison(
            inv_id=req.investigation_id,
            comparison_id=comparison.comparison_id,
            trace_a_id=req.trace_a_id,
            trace_b_id=req.trace_b_id,
        )

    return comparison


@router.get("/comparisons/{cmp_id}", response_model=ComparisonResult)
def get_comparison(cmp_id: str):
    cmp = Repository.get_comparison(cmp_id)
    if not cmp:
        raise HTTPException(status_code=404, detail=f"Comparison '{cmp_id}' not found.")
    return cmp


# ==================== REPLAY ENDPOINTS ====================


@router.get("/traces/{trace_id}/replay", response_model=ReplayStepResponse)
def replay_trace_step(trace_id: str, step: int = Query(1, ge=1)):
    events = Repository.get_trace_events(trace_id)
    if not events:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found.")

    return ReplayEngine.get_replay_step(events=events, step_index=step)


# ==================== AI INVESTIGATION ASSISTANT ====================


@router.get("/ai/status", response_model=AIStatusResponse)
async def get_ai_status():
    """
    Returns the real-time connectivity status of Ollama and the Qwen model.
    """
    return await ai_assistant.check_ollama_status()


class ExplainRequest(BaseModel):
    prefer_ollama: bool = True
    question: Optional[str] = None


@router.post("/investigations/{inv_id}/explain", response_model=AIExplanation)
async def explain_investigation(inv_id: str, payload: ExplainRequest = ExplainRequest()):
    inv = Repository.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation '{inv_id}' not found.")

    if not inv.comparison_id:
        raise HTTPException(
            status_code=400,
            detail="Investigation does not have an associated trace comparison yet. Please compare Trace A and Trace B first.",
        )

    comparison = Repository.get_comparison(inv.comparison_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="Comparison record not found.")

    events_a = Repository.get_trace_events(inv.trace_a_id) if inv.trace_a_id else []
    events_b = Repository.get_trace_events(inv.trace_b_id) if inv.trace_b_id else []

    explanation = await ai_assistant.generate_explanation(
        comparison=comparison,
        events_a=events_a,
        events_b=events_b,
        user_question=payload.question,
        prefer_ollama=payload.prefer_ollama,
    )

    Repository.save_explanation(inv_id, explanation)
    return explanation


@router.post("/comparisons/{cmp_id}/explain", response_model=AIExplanation)
async def explain_comparison_endpoint(cmp_id: str, payload: ExplainRequest = ExplainRequest()):
    comparison = Repository.get_comparison(cmp_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison '{cmp_id}' not found.")

    events_a = Repository.get_trace_events(comparison.trace_a_id) if comparison.trace_a_id else []
    events_b = Repository.get_trace_events(comparison.trace_b_id) if comparison.trace_b_id else []

    return await ai_assistant.generate_explanation(
        comparison=comparison,
        events_a=events_a,
        events_b=events_b,
        user_question=payload.question,
        prefer_ollama=payload.prefer_ollama,
    )


@router.post("/investigations/{inv_id}/chat", response_model=AIChatResponse)
async def chat_investigation_endpoint(inv_id: str, payload: AIChatRequest):
    inv = Repository.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation '{inv_id}' not found.")

    comparison = Repository.get_comparison(inv.comparison_id) if inv.comparison_id else None
    events_a = Repository.get_trace_events(inv.trace_a_id) if inv.trace_a_id else None
    events_b = Repository.get_trace_events(inv.trace_b_id) if inv.trace_b_id else None

    return await ai_assistant.chat_investigation(
        investigation_id=inv_id,
        question=payload.question,
        comparison=comparison,
        events_a=events_a,
        events_b=events_b,
        prefer_ollama=payload.prefer_ollama,
    )


@router.post("/comparisons/{cmp_id}/chat", response_model=AIChatResponse)
async def chat_comparison_endpoint(cmp_id: str, payload: AIChatRequest):
    comparison = Repository.get_comparison(cmp_id)
    if not comparison:
        raise HTTPException(status_code=404, detail=f"Comparison '{cmp_id}' not found.")

    events_a = Repository.get_trace_events(comparison.trace_a_id) if comparison.trace_a_id else None
    events_b = Repository.get_trace_events(comparison.trace_b_id) if comparison.trace_b_id else None

    return await ai_assistant.chat_investigation(
        investigation_id=cmp_id,
        question=payload.question,
        comparison=comparison,
        events_a=events_a,
        events_b=events_b,
        prefer_ollama=payload.prefer_ollama,
    )


class EventExplainPayload(BaseModel):
    prefer_ollama: bool = True


@router.post("/traces/{trace_id}/events/{event_id}/explain", response_model=EventExplanation)
async def explain_event_endpoint(trace_id: str, event_id: int, payload: EventExplainPayload = EventExplainPayload()):
    events = Repository.get_trace_events(trace_id)
    if not events:
        raise HTTPException(status_code=404, detail=f"Trace '{trace_id}' not found.")

    event = next((e for e in events if e.event_id == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event #{event_id} not found in trace '{trace_id}'.")

    return await ai_assistant.explain_event(
        event=event,
        trace_events=events,
        prefer_ollama=payload.prefer_ollama,
    )


# ==================== REPORTS & EXPORT ====================


@router.get("/investigations/{inv_id}/report", response_model=InvestigationReport)
def get_investigation_report(inv_id: str):
    inv = Repository.get_investigation(inv_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation '{inv_id}' not found.")

    meta_a = Repository.get_trace_metadata(inv.trace_a_id) if inv.trace_a_id else None
    meta_b = Repository.get_trace_metadata(inv.trace_b_id) if inv.trace_b_id else None
    cmp = Repository.get_comparison(inv.comparison_id) if inv.comparison_id else None
    explanation = Repository.get_explanation(inv_id)

    limitations = [
        "Replay simulation is deterministic and operates on captured state snapshots; unrecorded external mutations are unknown.",
        "Root cause hypotheses represent probable diagnostics based on error signatures; code-level confirmation is recommended.",
        "Trace fidelity is contingent on the breadth of fields supplied in the agent telemetry.",
    ]

    next_steps = [
        "Verify upstream service SLA / timeout tolerances for the divergent step.",
        "Inspect application logs for the external tool corresponding to the failure timestamp.",
        "Implement recommended retry and schema validation guards.",
        "Execute synthetic test in an isolated staging sandbox.",
    ]

    return InvestigationReport(
        investigation_id=inv.id,
        investigation_name=inv.name,
        created_at=inv.created_at,
        trace_a_id=inv.trace_a_id,
        trace_b_id=inv.trace_b_id,
        trace_a_metadata=meta_a,
        trace_b_metadata=meta_b,
        comparison=cmp,
        explanation=explanation,
        limitations=limitations,
        next_debugging_steps=next_steps,
    )


@router.get("/investigations/{inv_id}/export/csv")
def export_investigation_csv(inv_id: str):
    inv = Repository.get_investigation(inv_id)
    if not inv or not inv.comparison_id:
        raise HTTPException(status_code=404, detail="Comparison data not found for CSV export.")

    cmp = Repository.get_comparison(inv.comparison_id)
    if not cmp:
        raise HTTPException(status_code=404, detail="Comparison record not found.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Step_Index", "Alignment_Type", "Step_Name", "Tool_Name", "Trace_A_Status", "Trace_B_Status", "Differences_Note"])

    for s in cmp.aligned_steps:
        st_a = s.event_a.status if s.event_a else "MISSING"
        st_b = s.event_b.status if s.event_b else "MISSING"
        note = s.difference_note or ""
        writer.writerow([s.step_index, s.alignment_type, s.step_name, s.tool_name or "", st_a, st_b, note])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=investigation_{inv_id}_differences.csv"},
    )


# ==================== SAMPLES SEEDING ====================


@router.post("/samples/seed")
def seed_samples():
    """
    Loads the sample traces (successful_order, failed_order, changed_tool_response)
    and creates a ready-to-inspect default sample investigation.
    """
    base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample-data")

    samples_loaded = []
    files_to_load = [
        ("successful_order.json", "trace_success_001"),
        ("failed_order.json", "trace_failed_002"),
        ("changed_tool_response.json", "trace_changed_003"),
    ]

    for fname, default_id in files_to_load:
        fpath = os.path.join(base_dir, fname)
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                events, meta = parse_trace_content(content, default_trace_id=default_id)
                Repository.save_trace(meta.trace_id, events, meta)
                samples_loaded.append(meta.trace_id)

    # Automatically create the canonical demo investigation comparing Trace Success vs Trace Failed
    inv_id = "inv_demo_shopping_agent"
    existing = Repository.get_investigation(inv_id)
    if not existing:
        Repository.create_investigation(
            inv_id=inv_id,
            name="Demo: Shopping Agent Order Failure Investigation",
            description="Reference golden run vs upstream order-service timeout failure with cascading NOT_FOUND status.",
            trace_a_id="trace_success_001",
            trace_b_id="trace_failed_002",
        )

    # Pre-run comparison for the demo
    ev_a = Repository.get_trace_events("trace_success_001")
    ev_b = Repository.get_trace_events("trace_failed_002")
    if ev_a and ev_b:
        cmp = compare_traces(ev_a, ev_b, "trace_success_001", "trace_failed_002", comparison_id="cmp_demo_shopping")
        Repository.save_comparison(cmp)
        Repository.update_investigation_comparison(inv_id, cmp.comparison_id, "trace_success_001", "trace_failed_002")

        # Pre-seed rule-based explanation for instant demo inspection
        expl = ai_assistant._generate_rule_based_fallback(cmp)
        Repository.save_explanation(inv_id, expl)

    return {
        "message": "Sample traces and demo investigation seeded successfully.",
        "traces_loaded": samples_loaded,
        "demo_investigation_id": inv_id,
    }
