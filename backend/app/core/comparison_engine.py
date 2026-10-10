import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from app.schemas.trace_schemas import (
    AlignedStep,
    ComparisonResult,
    FieldDifference,
    StepAlignmentType,
    TraceEvent,
)


def _deep_equal(val_a: Any, val_b: Any) -> bool:
    """Compares two values for structural equality."""
    if val_a == val_b:
        return True
    if val_a is None or val_b is None:
        return val_a == val_b
    if isinstance(val_a, dict) and isinstance(val_b, dict):
        if set(val_a.keys()) != set(val_b.keys()):
            return False
        return all(_deep_equal(val_a[k], val_b[k]) for k in val_a)
    if isinstance(val_a, list) and isinstance(val_b, list):
        if len(val_a) != len(val_b):
            return False
        return all(_deep_equal(a, b) for a, b in zip(val_a, val_b))
    return str(val_a) == str(val_b)


def _compute_event_differences(event_a: TraceEvent, event_b: TraceEvent) -> List[FieldDifference]:
    """Examines fields of two aligned events to extract exact differences."""
    diffs: List[FieldDifference] = []

    # 1. Status difference
    if event_a.status != event_b.status:
        diffs.append(
            FieldDifference(
                field_name="status",
                value_a=event_a.status,
                value_b=event_b.status,
                description=f"Status changed from '{event_a.status}' in Trace A to '{event_b.status}' in Trace B.",
            )
        )

    # 2. Tool name difference
    if event_a.tool_name != event_b.tool_name:
        diffs.append(
            FieldDifference(
                field_name="tool_name",
                value_a=event_a.tool_name,
                value_b=event_b.tool_name,
                description=f"Tool changed from '{event_a.tool_name}' to '{event_b.tool_name}'.",
            )
        )

    # 3. Input difference
    if not _deep_equal(event_a.input, event_b.input):
        diffs.append(
            FieldDifference(
                field_name="input",
                value_a=event_a.input,
                value_b=event_b.input,
                description="Recorded tool/step input differs between executions.",
            )
        )

    # 4. Output difference (Crucial for tool response divergence)
    if not _deep_equal(event_a.output, event_b.output):
        desc = "Tool output differs."
        if isinstance(event_a.output, dict) and isinstance(event_b.output, dict):
            status_a = event_a.output.get("status")
            status_b = event_b.output.get("status")
            if status_a != status_b:
                desc = f"Tool output status changed from '{status_a}' in Trace A to '{status_b}' in Trace B."
        diffs.append(
            FieldDifference(
                field_name="output",
                value_a=event_a.output,
                value_b=event_b.output,
                description=desc,
            )
        )

    # 5. State transitions
    if not _deep_equal(event_a.state_after, event_b.state_after):
        diffs.append(
            FieldDifference(
                field_name="state_after",
                value_a=event_a.state_after,
                value_b=event_b.state_after,
                description="Resulting state ('state_after') differs between executions.",
            )
        )

    # 6. Error details
    if event_a.error != event_b.error:
        diffs.append(
            FieldDifference(
                field_name="error",
                value_a=event_a.error,
                value_b=event_b.error,
                description=f"Error message changed: Trace A had '{event_a.error}', Trace B had '{event_b.error}'.",
            )
        )

    return diffs


def align_traces_lcs(
    events_a: List[TraceEvent], events_b: List[TraceEvent]
) -> List[Tuple[Optional[TraceEvent], Optional[TraceEvent]]]:
    """
    Aligns two lists of TraceEvent objects using Needleman-Wunsch / LCS alignment
    matching on (step_name, tool_name).
    Handles omitted, extra, and inserted steps without shifting subsequent alignments.
    """
    n, m = len(events_a), len(events_b)

    # DP similarity scoring
    # Match: +3 if step_name & tool_name match, +2 if step_name matches, -1 for gap
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = -i
    for j in range(m + 1):
        dp[0][j] = -j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            ea = events_a[i - 1]
            eb = events_b[j - 1]

            score_diag = -2
            if ea.step_name == eb.step_name and ea.tool_name == eb.tool_name:
                score_diag = 4
            elif ea.step_name == eb.step_name:
                score_diag = 3
            elif ea.event_type == eb.event_type and ea.event_id == eb.event_id:
                score_diag = 1

            dp[i][j] = max(
                dp[i - 1][j - 1] + score_diag,  # match/mismatch
                dp[i - 1][j] - 1,              # gap in B
                dp[i][j - 1] - 1,              # gap in A
            )

    # Backtracking
    alignment: List[Tuple[Optional[TraceEvent], Optional[TraceEvent]]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            ea = events_a[i - 1]
            eb = events_b[j - 1]
            score_diag = -2
            if ea.step_name == eb.step_name and ea.tool_name == eb.tool_name:
                score_diag = 4
            elif ea.step_name == eb.step_name:
                score_diag = 3
            elif ea.event_type == eb.event_type and ea.event_id == eb.event_id:
                score_diag = 1

            if dp[i][j] == dp[i - 1][j - 1] + score_diag:
                alignment.append((ea, eb))
                i -= 1
                j -= 1
                continue

        if i > 0 and (j == 0 or dp[i][j] == dp[i - 1][j] - 1):
            alignment.append((events_a[i - 1], None))
            i -= 1
        else:
            alignment.append((None, events_b[j - 1]))
            j -= 1

    alignment.reverse()
    return alignment


def compare_traces(
    events_a: List[TraceEvent],
    events_b: List[TraceEvent],
    trace_a_id: str = "trace_a",
    trace_b_id: str = "trace_b",
    comparison_id: Optional[str] = None,
) -> ComparisonResult:
    """
    Core Deterministic Trace Comparison Engine.
    Identifies the First Observed Divergence and marks downstream differences.
    """
    if not comparison_id:
        comparison_id = f"cmp_{uuid.uuid4().hex[:10]}"

    raw_aligned = align_traces_lcs(events_a, events_b)

    aligned_steps: List[AlignedStep] = []
    first_divergence_idx: Optional[int] = None
    first_divergence_step_name: Optional[str] = None
    first_divergence_summary: Optional[str] = None
    downstream_diff_count = 0
    matched_count = 0
    unmatched_count = 0

    divergence_found = False

    for idx, (ea, eb) in enumerate(raw_aligned, start=1):
        if ea is not None and eb is not None:
            # Both events present
            diffs = _compute_event_differences(ea, eb)
            step_name = ea.step_name or eb.step_name
            tool_name = ea.tool_name or eb.tool_name

            if not diffs:
                # Exact match
                aligned_steps.append(
                    AlignedStep(
                        step_index=idx,
                        alignment_type=StepAlignmentType.MATCH,
                        step_name=step_name,
                        tool_name=tool_name,
                        event_a=ea,
                        event_b=eb,
                        field_differences=[],
                        difference_note="No differences detected. Exact match.",
                    )
                )
                matched_count += 1
            else:
                # Difference detected
                if not divergence_found:
                    # This is the FIRST OBSERVED DIVERGENCE!
                    divergence_found = True
                    first_divergence_idx = idx
                    first_divergence_step_name = step_name

                    primary_diff_desc = diffs[0].description
                    first_divergence_summary = (
                        f"First observed divergence at step '{step_name}'. {primary_diff_desc}"
                    )

                    aligned_steps.append(
                        AlignedStep(
                            step_index=idx,
                            alignment_type=StepAlignmentType.FIRST_DIVERGENCE,
                            step_name=step_name,
                            tool_name=tool_name,
                            event_a=ea,
                            event_b=eb,
                            field_differences=diffs,
                            difference_note=f"FIRST OBSERVED DIVERGENCE: {primary_diff_desc}",
                        )
                    )
                else:
                    # Downstream difference
                    downstream_diff_count += 1
                    aligned_steps.append(
                        AlignedStep(
                            step_index=idx,
                            alignment_type=StepAlignmentType.DOWNSTREAM_DIFFERENCE,
                            step_name=step_name,
                            tool_name=tool_name,
                            event_a=ea,
                            event_b=eb,
                            field_differences=diffs,
                            difference_note=f"Downstream consequence after first divergence: {diffs[0].description}",
                        )
                    )
        elif ea is not None and eb is None:
            # Event present in A but missing in B
            unmatched_count += 1
            step_name = ea.step_name
            tool_name = ea.tool_name
            diff_note = f"Event '{step_name}' present in Trace A was missing from Trace B."
            field_diffs = [
                FieldDifference(
                    field_name="event_presence",
                    value_a=f"Present (Event #{ea.event_id})",
                    value_b="Missing / Not Executed",
                    description=diff_note,
                )
            ]

            if not divergence_found:
                divergence_found = True
                first_divergence_idx = idx
                first_divergence_step_name = step_name
                first_divergence_summary = diff_note
                aligned_type = StepAlignmentType.FIRST_DIVERGENCE
            else:
                downstream_diff_count += 1
                aligned_type = StepAlignmentType.DOWNSTREAM_DIFFERENCE

            aligned_steps.append(
                AlignedStep(
                    step_index=idx,
                    alignment_type=aligned_type,
                    step_name=step_name,
                    tool_name=tool_name,
                    event_a=ea,
                    event_b=None,
                    field_differences=field_diffs,
                    difference_note=f"UNMATCHED (Trace A only): {diff_note}",
                )
            )
        else:
            # Event missing in A but present in B (extra event)
            assert eb is not None
            unmatched_count += 1
            step_name = eb.step_name
            tool_name = eb.tool_name
            diff_note = f"Extra event '{step_name}' occurred in Trace B that was not in Trace A."
            field_diffs = [
                FieldDifference(
                    field_name="event_presence",
                    value_a="Missing / Not Executed",
                    value_b=f"Present (Event #{eb.event_id})",
                    description=diff_note,
                )
            ]

            if not divergence_found:
                divergence_found = True
                first_divergence_idx = idx
                first_divergence_step_name = step_name
                first_divergence_summary = diff_note
                aligned_type = StepAlignmentType.FIRST_DIVERGENCE
            else:
                downstream_diff_count += 1
                aligned_type = StepAlignmentType.DOWNSTREAM_DIFFERENCE

            aligned_steps.append(
                AlignedStep(
                    step_index=idx,
                    alignment_type=aligned_type,
                    step_name=step_name,
                    tool_name=tool_name,
                    event_a=None,
                    event_b=eb,
                    field_differences=field_diffs,
                    difference_note=f"UNMATCHED (Trace B only): {diff_note}",
                )
            )

    # Produce evidence-based summary
    if not divergence_found:
        summary_text = (
            f"Traces {trace_a_id} and {trace_b_id} are identical across all "
            f"{len(aligned_steps)} aligned steps. No divergences observed."
        )
    else:
        summary_text = (
            f"First observed divergence identified at step '{first_divergence_step_name}' "
            f"(Step #{first_divergence_idx}). {first_divergence_summary}. "
            f"Subsequently, {downstream_diff_count} downstream differences were observed. "
            f"The recorded evidence confirms the divergence location; root cause must be verified against tool implementation."
        )

    ambiguity_notes = None
    if len(events_a) != len(events_b):
        ambiguity_notes = (
            f"Trace A contains {len(events_a)} events while Trace B contains {len(events_b)} events. "
            f"Alignment handled using Longest Common Subsequence."
        )

    return ComparisonResult(
        comparison_id=comparison_id,
        trace_a_id=trace_a_id,
        trace_b_id=trace_b_id,
        matching_strategy="Sequence-Aware Dual-Key Alignment (step_name, tool_name) with LCS Backtracking",
        total_steps_aligned=len(aligned_steps),
        first_divergence_index=first_divergence_idx,
        first_divergence_step_name=first_divergence_step_name,
        first_divergence_summary=first_divergence_summary,
        downstream_difference_count=downstream_diff_count,
        matched_count=matched_count,
        unmatched_count=unmatched_count,
        aligned_steps=aligned_steps,
        summary=summary_text,
        ambiguity_notes=ambiguity_notes,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
