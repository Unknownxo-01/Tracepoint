import json
from typing import Any, Dict, List, Tuple
from app.schemas.trace_schemas import TraceEvent, TraceMetadata


class TraceParseError(Exception):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message)
        self.message = message
        self.details = details


def parse_trace_content(raw_text: str, default_trace_id: str = "trace_upload") -> Tuple[List[TraceEvent], TraceMetadata]:
    """
    Parses raw trace content (JSON array, JSON object with 'events', or JSONL)
    into validated TraceEvent models and computes TraceMetadata.
    """
    text = raw_text.strip()
    if not text:
        raise TraceParseError("Trace content is empty.")

    events_raw: List[Dict[str, Any]] = []

    # Detect JSON vs JSONL
    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if not isinstance(parsed, list):
                raise TraceParseError("Expected a JSON array of events.")
            events_raw = parsed
        except json.JSONDecodeError as e:
            raise TraceParseError(f"Malformed JSON array: {e.msg} at line {e.lineno}, col {e.colno}")
    elif text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and "events" in parsed and isinstance(parsed["events"], list):
                events_raw = parsed["events"]
                trace_id_override = parsed.get("trace_id", default_trace_id)
                for item in events_raw:
                    if isinstance(item, dict) and "trace_id" not in item:
                        item["trace_id"] = trace_id_override
            else:
                # Could be a single JSON object (first line of JSONL or single event)
                # Check if it has multiple lines
                lines = [line.strip() for line in text.splitlines() if line.strip()]
                if len(lines) == 1:
                    events_raw = [parsed]
                else:
                    # Treat as JSONL
                    events_raw = []
                    for idx, line in enumerate(lines, start=1):
                        try:
                            obj = json.loads(line)
                            if not isinstance(obj, dict):
                                raise TraceParseError(f"Line {idx} is not a valid JSON object.")
                            events_raw.append(obj)
                        except json.JSONDecodeError as err:
                            raise TraceParseError(f"Invalid JSON on line {idx}: {err.msg}")
        except json.JSONDecodeError as e:
            # Fallback check for JSONL
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            events_raw = []
            for idx, line in enumerate(lines, start=1):
                try:
                    obj = json.loads(line)
                    if not isinstance(obj, dict):
                        raise TraceParseError(f"Line {idx} is not a valid JSON object.")
                    events_raw.append(obj)
                except json.JSONDecodeError as err:
                    raise TraceParseError(f"Invalid JSON/JSONL at line {idx}: {err.msg}")
    else:
        # Try JSONL
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            raise TraceParseError("Trace file has no recognizable JSON or JSONL data.")
        events_raw = []
        for idx, line in enumerate(lines, start=1):
            try:
                obj = json.loads(line)
                if not isinstance(obj, dict):
                    raise TraceParseError(f"Line {idx} must be a JSON object.")
                events_raw.append(obj)
            except json.JSONDecodeError as err:
                raise TraceParseError(f"Invalid JSONL syntax at line {idx}: {err.msg}")

    if not events_raw:
        raise TraceParseError("No trace events found in upload.")

    validated_events: List[TraceEvent] = []
    error_count = 0
    total_duration = 0.0

    for idx, raw_evt in enumerate(events_raw, start=1):
        if not isinstance(raw_evt, dict):
            raise TraceParseError(f"Event #{idx} is not an object.")

        # Ensure required fields have valid defaults if missing
        if "trace_id" not in raw_evt or not raw_evt["trace_id"]:
            raw_evt["trace_id"] = default_trace_id
        if "event_id" not in raw_evt:
            raw_evt["event_id"] = idx
        if "step_name" not in raw_evt or not str(raw_evt["step_name"]).strip():
            raw_evt["step_name"] = f"step_{idx}"
        if "status" not in raw_evt or not raw_evt["status"]:
            raw_evt["status"] = "failure" if raw_evt.get("error") else "success"

        try:
            evt = TraceEvent(**raw_evt)
            validated_events.append(evt)
            if evt.status in ["failure", "error"] or evt.error:
                error_count += 1
            if evt.duration_ms:
                total_duration += evt.duration_ms
        except Exception as e:
            raise TraceParseError(f"Validation failure in event #{idx} ('{raw_evt.get('step_name')}'): {str(e)}")

    # Sort deterministically by event_id, and if timestamps present, verify order
    validated_events.sort(key=lambda x: x.event_id)

    primary_trace_id = validated_events[0].trace_id if validated_events else default_trace_id
    primary_agent = validated_events[0].agent_name or "unknown_agent"
    primary_run_id = validated_events[0].run_id

    metadata = TraceMetadata(
        trace_id=primary_trace_id,
        agent_name=primary_agent,
        run_id=primary_run_id,
        event_count=len(validated_events),
        error_count=error_count,
        status_summary="FAILED" if error_count > 0 else "SUCCESS",
        first_timestamp=validated_events[0].timestamp if validated_events else None,
        last_timestamp=validated_events[-1].timestamp if validated_events else None,
        total_duration_ms=round(total_duration, 2) if total_duration > 0 else None,
    )

    return validated_events, metadata
