from typing import Any, Dict, List
from app.schemas.trace_schemas import ReplayStepResponse, TraceEvent


class ReplayEngine:
    """
    Controlled forensic replay simulation of recorded trace events.
    Never executes external code or contacts live tools/APIs.
    Accurately reconstructs state history and recorded responses.
    """

    @staticmethod
    def get_replay_step(
        events: List[TraceEvent],
        step_index: int,
    ) -> ReplayStepResponse:
        if not events:
            raise ValueError("No events available for replay.")

        total_steps = len(events)
        # Clamping step_index to 1..total_steps
        step_idx = max(1, min(step_index, total_steps))
        current_event = events[step_idx - 1]

        # Accumulate state from event 1 to step_idx
        accumulated_state: Dict[str, Any] = {}
        for ev in events[:step_idx]:
            if ev.state_after:
                accumulated_state.update(ev.state_after)
            elif ev.state_before and not accumulated_state:
                accumulated_state.update(ev.state_before)

        return ReplayStepResponse(
            trace_id=current_event.trace_id,
            step_index=step_idx,
            total_steps=total_steps,
            current_event=current_event,
            accumulated_state=accumulated_state,
            recorded_tool_response=current_event.output,
            is_simulated=True,
            safety_guarantee="Deterministic replay environment: Tool outputs retrieved strictly from recorded trace. Zero live API side effects.",
        )
