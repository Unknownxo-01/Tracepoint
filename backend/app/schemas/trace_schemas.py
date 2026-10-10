from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class TraceEvent(BaseModel):
    trace_id: str
    agent_name: Optional[str] = "agent"
    run_id: Optional[str] = None
    event_id: int
    timestamp: Optional[str] = None
    event_type: str = "tool_response"  # tool_call, tool_response, state_update, final_output, agent_thought
    step_name: str
    tool_name: Optional[str] = None
    input: Optional[Any] = None
    output: Optional[Any] = None
    state_before: Optional[Dict[str, Any]] = None
    state_after: Optional[Dict[str, Any]] = None
    status: str = "success"  # success, warning, failure, error
    error: Optional[str] = None
    duration_ms: Optional[float] = None


class TraceMetadata(BaseModel):
    trace_id: str
    agent_name: str
    run_id: Optional[str] = None
    event_count: int
    error_count: int
    status_summary: str
    first_timestamp: Optional[str] = None
    last_timestamp: Optional[str] = None
    total_duration_ms: Optional[float] = None


class TraceUploadResponse(BaseModel):
    trace_id: str
    agent_name: str
    event_count: int
    message: str
    metadata: TraceMetadata


class FieldDifference(BaseModel):
    field_name: str
    value_a: Any
    value_b: Any
    description: str


class StepAlignmentType(str):
    MATCH = "MATCH"
    FIRST_DIVERGENCE = "FIRST_DIVERGENCE"
    DOWNSTREAM_DIFFERENCE = "DOWNSTREAM_DIFFERENCE"
    UNMATCHED_A = "UNMATCHED_A"
    UNMATCHED_B = "UNMATCHED_B"


class AlignedStep(BaseModel):
    step_index: int
    alignment_type: str  # MATCH, FIRST_DIVERGENCE, DOWNSTREAM_DIFFERENCE, UNMATCHED_A, UNMATCHED_B
    step_name: str
    tool_name: Optional[str] = None
    event_a: Optional[TraceEvent] = None
    event_b: Optional[TraceEvent] = None
    field_differences: List[FieldDifference] = []
    difference_note: Optional[str] = None


class ComparisonResult(BaseModel):
    comparison_id: str
    trace_a_id: str
    trace_b_id: str
    matching_strategy: str
    total_steps_aligned: int
    first_divergence_index: Optional[int] = None
    first_divergence_step_name: Optional[str] = None
    first_divergence_summary: Optional[str] = None
    downstream_difference_count: int = 0
    matched_count: int = 0
    unmatched_count: int = 0
    aligned_steps: List[AlignedStep] = []
    summary: str
    ambiguity_notes: Optional[str] = None
    created_at: str


class ComparisonRequest(BaseModel):
    trace_a_id: str
    trace_b_id: str
    investigation_id: Optional[str] = None


class InvestigationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trace_a_id: Optional[str] = None
    trace_b_id: Optional[str] = None


class InvestigationRecord(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str
    trace_a_id: Optional[str] = None
    trace_b_id: Optional[str] = None
    comparison_id: Optional[str] = None
    status: str = "active"


class AIExplanation(BaseModel):
    provider: str  # "ollama" | "rule_based_fallback"
    provider_label: str  # Human-readable provider label (e.g. "Qwen (qwen2.5:latest)" or "Rule-based diagnosis")
    summary: str
    first_divergence_analysis: str
    downstream_effects: List[str]
    evidence_citations: List[str]
    hypotheses: List[str]
    safe_testing_checklist: List[str]
    recommended_remediation: str
    is_fallback: bool
    generated_at: str
    supported_event_ids: List[int] = []
    inspect_next: List[str] = []


class AIStatusResponse(BaseModel):
    ollama_available: bool
    ollama_url: str
    model_name: str
    model_installed: bool
    available_models: List[str] = []
    status_message: str


class ReplayStepResponse(BaseModel):
    trace_id: str
    step_index: int
    total_steps: int
    current_event: TraceEvent
    accumulated_state: Dict[str, Any]
    recorded_tool_response: Any
    is_simulated: bool = True
    safety_guarantee: str = "Zero external side effects. Tool output is retrieved from recorded trace."


class EventExplanation(BaseModel):
    trace_id: str
    event_id: int
    step_name: str
    tool_name: Optional[str] = None
    provider: str
    provider_label: str
    is_fallback: bool
    status: str
    analysis: str
    input_summary: str
    output_summary: str
    state_change_summary: str
    potential_impact: str
    generated_at: str


class AIChatRequest(BaseModel):
    investigation_id: str
    question: str
    prefer_ollama: bool = True


class AIChatResponse(BaseModel):
    investigation_id: str
    question: str
    answer: str
    supporting_evidence: List[str] = []
    missing_evidence_notes: Optional[str] = None
    provider: str
    provider_label: str
    is_fallback: bool
    generated_at: str


class InvestigationReport(BaseModel):
    investigation_id: str
    investigation_name: str
    created_at: str
    trace_a_id: Optional[str] = None
    trace_b_id: Optional[str] = None
    trace_a_metadata: Optional[TraceMetadata] = None
    trace_b_metadata: Optional[TraceMetadata] = None
    comparison: Optional[ComparisonResult] = None
    explanation: Optional[AIExplanation] = None
    limitations: List[str]
    next_debugging_steps: List[str]
