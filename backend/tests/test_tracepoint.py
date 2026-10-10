import json
import os
import pytest
from app.core.trace_parser import parse_trace_content, TraceParseError
from app.core.comparison_engine import compare_traces
from app.core.replay_engine import ReplayEngine
from app.core.ai_assistant import AIAssistant
from app.schemas.trace_schemas import TraceEvent, StepAlignmentType
from app.db.database import init_db
from app.db.repository import Repository
from app.api.routes import get_investigation_report


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_tracepoint.db"
    monkeypatch.setenv("TRACEPOINT_DB_PATH", str(test_db))
    # Re-initialize DB module
    import app.db.database as db_mod
    monkeypatch.setattr(db_mod, "DB_PATH", str(test_db))
    db_mod.init_db()


def test_parse_json_array():
    sample_json = json.dumps([
        {
            "trace_id": "test_trace",
            "event_id": 1,
            "step_name": "step_one",
            "tool_name": "calc",
            "status": "success",
            "output": {"result": 42}
        }
    ])
    events, meta = parse_trace_content(sample_json)
    assert len(events) == 1
    assert events[0].step_name == "step_one"
    assert meta.event_count == 1
    assert meta.status_summary == "SUCCESS"


def test_parse_jsonl():
    jsonl_content = (
        '{"trace_id":"t1","event_id":1,"step_name":"init","status":"success"}\n'
        '{"trace_id":"t1","event_id":2,"step_name":"fetch","status":"failure","error":"404"}\n'
    )
    events, meta = parse_trace_content(jsonl_content)
    assert len(events) == 2
    assert events[0].step_name == "init"
    assert events[1].step_name == "fetch"
    assert meta.error_count == 1
    assert meta.status_summary == "FAILED"


def test_invalid_schema_handling():
    with pytest.raises(TraceParseError):
        parse_trace_content("INVALID_NON_JSON")

    with pytest.raises(TraceParseError):
        parse_trace_content("")


def test_exact_trace_match():
    ev1 = TraceEvent(trace_id="a", event_id=1, step_name="step_a", tool_name="tool_1", status="success", output={"ok": True})
    ev2 = TraceEvent(trace_id="a", event_id=2, step_name="step_b", tool_name="tool_2", status="success", output={"done": True})

    cmp = compare_traces([ev1, ev2], [ev1, ev2])
    assert cmp.first_divergence_index is None
    assert cmp.downstream_difference_count == 0
    assert cmp.matched_count == 2
    assert "identical across all 2 aligned steps" in cmp.summary


def test_tool_response_divergence_and_downstream():
    # Step 1: Same
    e1_a = TraceEvent(trace_id="a", event_id=1, step_name="payment", tool_name="pay", status="success", output={"status": "SUCCESS"})
    e1_b = TraceEvent(trace_id="b", event_id=1, step_name="payment", tool_name="pay", status="success", output={"status": "SUCCESS"})

    # Step 2: Tool output diverged!
    e2_a = TraceEvent(trace_id="a", event_id=2, step_name="create_order", tool_name="ord", status="success", output={"status": "SUCCESS"})
    e2_b = TraceEvent(trace_id="b", event_id=2, step_name="create_order", tool_name="ord", status="failure", output={"status": "FAILED"}, error="Timeout")

    # Step 3: Downstream cascade!
    e3_a = TraceEvent(trace_id="a", event_id=3, step_name="fulfillment", tool_name="ful", status="success", output={"status": "CONFIRMED"})
    e3_b = TraceEvent(trace_id="b", event_id=3, step_name="fulfillment", tool_name="ful", status="failure", output={"status": "NOT_FOUND"})

    cmp = compare_traces([e1_a, e2_a, e3_a], [e1_b, e2_b, e3_b])

    assert cmp.first_divergence_index == 2
    assert cmp.first_divergence_step_name == "create_order"
    assert cmp.aligned_steps[0].alignment_type == StepAlignmentType.MATCH
    assert cmp.aligned_steps[1].alignment_type == StepAlignmentType.FIRST_DIVERGENCE
    assert cmp.aligned_steps[2].alignment_type == StepAlignmentType.DOWNSTREAM_DIFFERENCE
    assert cmp.downstream_difference_count == 1


def test_missing_and_extra_events():
    e1 = TraceEvent(trace_id="a", event_id=1, step_name="step1", status="success")
    e2 = TraceEvent(trace_id="a", event_id=2, step_name="step2", status="success")
    e3 = TraceEvent(trace_id="a", event_id=3, step_name="step3", status="success")

    # Trace B misses step2
    cmp = compare_traces([e1, e2, e3], [e1, e3])
    # Step 2 is missing from B
    assert cmp.unmatched_count >= 1
    assert any(s.alignment_type == StepAlignmentType.FIRST_DIVERGENCE and s.step_name == "step2" for s in cmp.aligned_steps)


def test_state_difference():
    e1_a = TraceEvent(trace_id="a", event_id=1, step_name="stateful_step", status="success", state_after={"balance": 100})
    e1_b = TraceEvent(trace_id="b", event_id=1, step_name="stateful_step", status="success", state_after={"balance": 50})

    cmp = compare_traces([e1_a], [e1_b])
    assert cmp.first_divergence_index == 1
    assert any(d.field_name == "state_after" for d in cmp.aligned_steps[0].field_differences)


def test_replay_isolation_and_no_side_effects():
    events = [
        TraceEvent(trace_id="test", event_id=1, step_name="pay", status="success", state_after={"paid": True}, output={"tx": 123}),
        TraceEvent(trace_id="test", event_id=2, step_name="ship", status="success", state_after={"shipped": True}, output={"tracking": "XYZ"}),
    ]

    # Replay step 1
    res1 = ReplayEngine.get_replay_step(events, step_index=1)
    assert res1.step_index == 1
    assert res1.is_simulated is True
    assert res1.accumulated_state == {"paid": True}
    assert res1.recorded_tool_response == {"tx": 123}

    # Replay step 2
    res2 = ReplayEngine.get_replay_step(events, step_index=2)
    assert res2.step_index == 2
    assert res2.accumulated_state == {"paid": True, "shipped": True}
    assert res2.recorded_tool_response == {"tracking": "XYZ"}


def test_rule_based_ai_fallback_explanation():
    e1_a = TraceEvent(trace_id="a", event_id=1, step_name="create_order", tool_name="ord_svc", status="success", output={"status": "SUCCESS"})
    e1_b = TraceEvent(trace_id="b", event_id=1, step_name="create_order", tool_name="ord_svc", status="failure", output={"status": "FAILED"}, error="Connection timeout 3000ms")

    cmp = compare_traces([e1_a], [e1_b])
    assistant = AIAssistant()
    expl = assistant._generate_rule_based_fallback(cmp)

    assert expl.is_fallback is True
    assert expl.provider == "rule_based_fallback"
    assert "create_order" in expl.first_divergence_analysis
    assert len(expl.hypotheses) > 0
    assert len(expl.safe_testing_checklist) > 0
    assert any("timeout" in h.lower() for h in expl.hypotheses)


def test_report_generation():
    ev_a = TraceEvent(trace_id="tA", event_id=1, step_name="s1", status="success")
    ev_b = TraceEvent(trace_id="tB", event_id=1, step_name="s1", status="failure", error="err")

    Repository.save_trace("tA", [ev_a], parse_trace_content(json.dumps([ev_a.model_dump()]))[1])
    Repository.save_trace("tB", [ev_b], parse_trace_content(json.dumps([ev_b.model_dump()]))[1])

    inv = Repository.create_investigation("inv_test_rep", "Report Test", "Desc", "tA", "tB")
    cmp = compare_traces([ev_a], [ev_b], "tA", "tB")
    Repository.save_comparison(cmp)
    Repository.update_investigation_comparison("inv_test_rep", cmp.comparison_id, "tA", "tB")

    report = get_investigation_report("inv_test_rep")
    assert report.investigation_id == "inv_test_rep"
    assert report.comparison is not None
    assert len(report.limitations) > 0
    assert len(report.next_debugging_steps) > 0


@pytest.mark.anyio
async def test_explain_single_event():
    ev = TraceEvent(
        trace_id="t1",
        event_id=2,
        step_name="create_order",
        tool_name="order_service",
        status="failure",
        error="Timeout 3000ms",
        input={"order_id": "ORD-1"},
        output={"status": "FAILED"}
    )
    assistant = AIAssistant()
    res = await assistant.explain_event(ev, prefer_ollama=False)
    assert res.is_fallback is True
    assert res.provider == "rule_based_fallback"
    assert "Timeout 3000ms" in res.analysis
    assert "ORD-1" in res.input_summary


@pytest.mark.anyio
async def test_chat_investigation_grounded_and_missing_evidence():
    ev_a = TraceEvent(trace_id="tA", event_id=1, step_name="payment_check", status="success", input={"amount": 299.99}, output={"status": "SUCCESS"})
    ev_b = TraceEvent(trace_id="tB", event_id=1, step_name="payment_check", status="failure", error="Gateway Error", output={"status": "FAILED"})
    cmp = compare_traces([ev_a], [ev_b], "tA", "tB")

    assistant = AIAssistant()

    # Question about failure
    res_fail = await assistant.chat_investigation("inv_test", "Why did it fail?", cmp, [ev_a], [ev_b], prefer_ollama=False)
    assert "payment_check" in res_fail.answer
    assert len(res_fail.supporting_evidence) > 0

    # Question about unrecorded/missing data
    res_missing = await assistant.chat_investigation("inv_test", "What is the secret server password?", cmp, [ev_a], [ev_b], prefer_ollama=False)
    assert "does not contain" in res_missing.answer
    assert res_missing.missing_evidence_notes is not None


@pytest.mark.anyio
async def test_ollama_qwen_chat_integration_success(monkeypatch):
    """
    Verifies that when Ollama /api/chat responds successfully with Qwen format,
    the assistant correctly parses the chat response, labels provider as Qwen,
    and grounds the diagnosis.
    """
    ev_a = TraceEvent(trace_id="tA", event_id=1, step_name="payment_check", status="success", output={"status": "SUCCESS"})
    ev_b = TraceEvent(trace_id="tB", event_id=1, step_name="payment_check", status="failure", error="Gateway timeout", output={"status": "FAILED"})
    cmp = compare_traces([ev_a], [ev_b], "tA", "tB")

    mock_ollama_response = {
        "model": "qwen2.5:latest",
        "created_at": "2026-10-09T12:00:00Z",
        "message": {
            "role": "assistant",
            "content": json.dumps({
                "summary": "Agent execution failed due to gateway timeout during payment_check.",
                "first_divergence_analysis": "The first divergence occurred at step #1 ('payment_check') where Gateway timeout was encountered.",
                "downstream_effects": ["Downstream fulfillment was prevented."],
                "evidence_citations": ["Event #1 in Trace B recorded Gateway timeout."],
                "supported_event_ids": [1],
                "hypotheses": ["[UNPROVEN HYPOTHESIS] Payment provider experienced transient degradation."],
                "inspect_next": ["Inspect payment gateway latency logs."],
                "recommended_remediation": "Add exponential backoff with 3 retries.",
                "safe_testing_checklist": ["Simulate gateway timeout in sandbox environment."],
            }),
        },
        "done": True,
    }

    import httpx

    class MockResponse:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return mock_ollama_response

    class MockAsyncClient:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, json=None, **kwargs):
            assert "/api/chat" in url
            assert json["model"] == "qwen2.5:latest"
            assert len(json["messages"]) == 2
            assert json["messages"][0]["role"] == "system"
            assert json["messages"][1]["role"] == "user"
            return MockResponse()

    monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)

    assistant = AIAssistant(model_name="qwen2.5:latest")
    expl = await assistant.generate_explanation(cmp, [ev_a], [ev_b], prefer_ollama=True)

    assert expl.provider == "ollama"
    assert "Qwen" in expl.provider_label
    assert expl.is_fallback is False
    assert 1 in expl.supported_event_ids
    assert len(expl.hypotheses) > 0
    assert "[UNPROVEN HYPOTHESIS]" in expl.hypotheses[0]


@pytest.mark.anyio
async def test_ollama_timeout_and_connection_error_fallback(monkeypatch):
    """
    Verifies graceful fallback to 'Rule-based diagnosis' when Ollama times out or is offline.
    """
    ev_a = TraceEvent(trace_id="tA", event_id=1, step_name="payment_check", status="success", output={"status": "SUCCESS"})
    ev_b = TraceEvent(trace_id="tB", event_id=1, step_name="payment_check", status="failure", error="Timeout", output={"status": "FAILED"})
    cmp = compare_traces([ev_a], [ev_b], "tA", "tB")

    import httpx

    class FailingAsyncClient:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, *args, **kwargs):
            raise httpx.ConnectError("Connection refused")

    monkeypatch.setattr(httpx, "AsyncClient", FailingAsyncClient)

    assistant = AIAssistant()
    expl = await assistant.generate_explanation(cmp, [ev_a], [ev_b], prefer_ollama=True)

    assert expl.is_fallback is True
    assert expl.provider == "rule_based_fallback"
    assert expl.provider_label == "Rule-based diagnosis"
    assert len(expl.hypotheses) > 0
    assert any("[UNPROVEN HYPOTHESIS]" in h for h in expl.hypotheses)


@pytest.mark.anyio
async def test_sample_order_creation_timeout_scenario():
    """
    End-to-end verification of the sample order-creation timeout scenario.
    Validates deterministic divergence isolation and grounded AI diagnosis.
    """
    sample_success_path = os.path.join(os.path.dirname(__file__), "..", "sample-data", "successful_order.json")
    sample_failed_path = os.path.join(os.path.dirname(__file__), "..", "sample-data", "failed_order.json")

    with open(sample_success_path, "r", encoding="utf-8") as f:
        events_a, _ = parse_trace_content(f.read(), default_trace_id="success_trace")
    with open(sample_failed_path, "r", encoding="utf-8") as f:
        events_b, _ = parse_trace_content(f.read(), default_trace_id="failed_trace")

    # 1. Deterministic comparison engine runs independently
    cmp = compare_traces(events_a, events_b, "success_trace", "failed_trace")
    assert cmp.first_divergence_index == 2
    assert cmp.first_divergence_step_name == "create_order"
    assert cmp.downstream_difference_count == 2

    # 2. AI diagnosis grounds explanation in real comparison evidence
    assistant = AIAssistant()
    expl = await assistant.generate_explanation(cmp, events_a, events_b, prefer_ollama=False)

    assert expl.provider_label == "Rule-based diagnosis"
    assert "create_order" in expl.first_divergence_analysis
    assert 2 in expl.supported_event_ids
    assert len(expl.downstream_effects) == 2
    assert any("timeout" in h.lower() for h in expl.hypotheses)
    assert len(expl.safe_testing_checklist) >= 3

