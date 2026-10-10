import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from dotenv import load_dotenv

from app.schemas.trace_schemas import (
    AIChatResponse,
    AIExplanation,
    ComparisonResult,
    EventExplanation,
    TraceEvent,
)

# Load environment variables from .env if present
load_dotenv()

logger = logging.getLogger("tracepoint.ai")


class AIAssistant:
    """
    Qwen AI Investigation Agent for TRACEPOINT.
    Connects to local Ollama via `/api/chat` to provide evidence-grounded failure explanations,
    divergence diagnostics, hypotheses, and safe-testing checklists.
    Preserves strict separation between deterministic divergence detection and AI explanation.
    Gracefully falls back to a deterministic 'Rule-based diagnosis' whenever Ollama or Qwen is unavailable.
    """

    def __init__(
        self,
        ollama_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        # Read from environment variables with sensible defaults
        env_url = os.environ.get("OLLAMA_URL") or os.environ.get("OLLAMA_BASE_URL") or "http://localhost:11434"
        env_model = os.environ.get("OLLAMA_MODEL") or os.environ.get("QWEN_MODEL") or "qwen2.5:latest"
        env_timeout = float(os.environ.get("OLLAMA_TIMEOUT", "45.0"))

        self.ollama_url = (ollama_url or env_url).rstrip("/")
        self.model_name = model_name or env_model
        self.timeout = timeout if timeout is not None else env_timeout

        logger.info(
            f"Initialized AIAssistant targeting Ollama at '{self.ollama_url}' with model '{self.model_name}' (timeout: {self.timeout}s)"
        )

    async def check_ollama_status(self) -> Dict[str, Any]:
        """
        Probes the local Ollama instance to verify service connectivity and model availability.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.ollama_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    # Check if requested model or matching prefix exists
                    target = self.model_name.lower()
                    model_found = any(
                        target in m.lower() or m.lower().startswith(target.split(":")[0])
                        for m in models
                    )
                    return {
                        "ollama_available": True,
                        "ollama_url": self.ollama_url,
                        "model_name": self.model_name,
                        "model_installed": model_found,
                        "available_models": models,
                        "status_message": (
                            f"Ollama is running with model '{self.model_name}' ready."
                            if model_found
                            else f"Ollama is running, but model '{self.model_name}' is not in installed tags: {models}. Run: ollama run {self.model_name}"
                        ),
                    }
                else:
                    return {
                        "ollama_available": False,
                        "ollama_url": self.ollama_url,
                        "model_name": self.model_name,
                        "model_installed": False,
                        "available_models": [],
                        "status_message": f"Ollama returned HTTP {resp.status_code}: {resp.text}",
                    }
        except httpx.ConnectError:
            return {
                "ollama_available": False,
                "ollama_url": self.ollama_url,
                "model_name": self.model_name,
                "model_installed": False,
                "available_models": [],
                "status_message": f"Cannot connect to Ollama at {self.ollama_url}. Please ensure Ollama is running ('ollama serve').",
            }
        except Exception as e:
            return {
                "ollama_available": False,
                "ollama_url": self.ollama_url,
                "model_name": self.model_name,
                "model_installed": False,
                "available_models": [],
                "status_message": f"Ollama check failed: {str(e)}",
            }

    async def generate_explanation(
        self,
        comparison: ComparisonResult,
        events_a: Optional[List[TraceEvent]] = None,
        events_b: Optional[List[TraceEvent]] = None,
        user_question: Optional[str] = None,
        prefer_ollama: bool = True,
    ) -> AIExplanation:
        """
        Generates evidence-grounded diagnosis for comparison results.
        Uses Ollama's /api/chat with Qwen when available; falls back to 'Rule-based diagnosis'.
        """
        fallback_reason = ""
        if prefer_ollama:
            try:
                explanation = await self._generate_with_ollama(
                    comparison=comparison,
                    events_a=events_a,
                    events_b=events_b,
                    user_question=user_question,
                )
                if explanation:
                    return explanation
            except httpx.ConnectError:
                fallback_reason = f"Ollama connection refused at {self.ollama_url}"
                logger.warning(f"{fallback_reason}. Engaging Rule-based diagnosis.")
            except httpx.TimeoutException:
                fallback_reason = f"Ollama request timed out after {self.timeout}s"
                logger.warning(f"{fallback_reason}. Engaging Rule-based diagnosis.")
            except httpx.HTTPStatusError as e:
                fallback_reason = f"Ollama HTTP error {e.response.status_code}"
                logger.warning(f"{fallback_reason}: {e.response.text}. Engaging Rule-based diagnosis.")
            except Exception as e:
                fallback_reason = f"Ollama execution error: {str(e)}"
                logger.warning(f"{fallback_reason}. Engaging Rule-based diagnosis.")

        # Fall back to deterministic forensic rule-based diagnosis
        return self._generate_rule_based_fallback(
            comparison=comparison,
            events_a=events_a,
            events_b=events_b,
            user_question=user_question,
            fallback_reason=fallback_reason,
        )

    async def _generate_with_ollama(
        self,
        comparison: ComparisonResult,
        events_a: Optional[List[TraceEvent]] = None,
        events_b: Optional[List[TraceEvent]] = None,
        user_question: Optional[str] = None,
    ) -> Optional[AIExplanation]:
        """
        Calls Ollama `/api/chat` with structured messages and real telemetry context.
        """
        system_prompt, user_content = self._build_chat_payload(
            comparison=comparison,
            events_a=events_a,
            events_b=events_b,
            user_question=user_question,
        )

        chat_body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ollama_url}/api/chat",
                json=chat_body,
            )
            resp.raise_for_status()

            data = resp.json()
            message_content = data.get("message", {}).get("content", "")
            if not message_content:
                logger.warning("Ollama /api/chat returned empty message content.")
                return None

            try:
                parsed = json.loads(message_content)
            except json.JSONDecodeError as jde:
                logger.warning(f"Failed to decode Ollama JSON response: {jde}. Raw text: {message_content[:200]}")
                # Try finding JSON substring
                start = message_content.find("{")
                end = message_content.rfind("}")
                if start != -1 and end != -1:
                    parsed = json.loads(message_content[start : end + 1])
                else:
                    return None

            # Collect supported event IDs from parsed or comparison
            supported_ids = parsed.get("supported_event_ids")
            if not supported_ids:
                supported_ids = []
                if comparison.first_divergence_index:
                    supported_ids.append(comparison.first_divergence_index)
                for step in comparison.aligned_steps:
                    if step.alignment_type == "DOWNSTREAM_DIFFERENCE":
                        supported_ids.append(step.step_index)

            return AIExplanation(
                provider="ollama",
                provider_label=f"Qwen ({self.model_name})",
                summary=parsed.get("summary", comparison.summary),
                first_divergence_analysis=parsed.get(
                    "first_divergence_analysis",
                    f"First divergence occurred at step '{comparison.first_divergence_step_name}'.",
                ),
                downstream_effects=parsed.get("downstream_effects", []),
                evidence_citations=parsed.get("evidence_citations", []),
                hypotheses=parsed.get("hypotheses", []),
                safe_testing_checklist=parsed.get("safe_testing_checklist", []),
                recommended_remediation=parsed.get("recommended_remediation", ""),
                is_fallback=False,
                generated_at=datetime.now(timezone.utc).isoformat(),
                supported_event_ids=supported_ids,
                inspect_next=parsed.get("inspect_next", [
                    "Inspect tool service logs for the divergent step timestamp.",
                    "Verify agent request timeout ceiling against upstream service SLA.",
                    "Audit database state before and after the failure point."
                ]),
            )

    def _build_chat_payload(
        self,
        comparison: ComparisonResult,
        events_a: Optional[List[TraceEvent]] = None,
        events_b: Optional[List[TraceEvent]] = None,
        user_question: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Constructs real investigation evidence payload for Qwen.
        Includes identifiers, first divergence, tool calls, field diffs, state diffs, errors, and cascades.
        """
        system_prompt = (
            "You are the Qwen AI Investigation Agent for TRACEPOINT — an AI-Agent Failure Investigation Platform.\n"
            "Your mission: Provide rigorous, evidence-grounded forensic failure analysis for autonomous AI agents.\n\n"
            "MANDATORY FORENSIC RULES:\n"
            "1. Ground all findings STRICTLY in the provided trace telemetry and comparison data.\n"
            "2. The deterministic comparison engine has already isolated the FIRST OBSERVED DIVERGENCE. You explain it — do NOT invent an alternative divergence point.\n"
            "3. Clearly distinguish RECORDED EVIDENCE (facts verified by event IDs, inputs, outputs, errors, state diffs) from UNPROVEN HYPOTHESES (probable root causes).\n"
            "4. NEVER invent missing evidence or claim that correlation proves causation.\n"
            "5. Never execute code or suggest automatic live code execution. Provide recommended fixes and safe sandbox validation steps.\n"
            "6. Return JSON ONLY with the exact schema requested."
        )

        # Assemble rich evidence context from real trace data
        div_idx = comparison.first_divergence_index
        div_step = comparison.first_divergence_step_name

        # Find divergent step object
        div_step_obj = next((s for s in comparison.aligned_steps if s.step_index == div_idx), None)

        # Extract tool details
        divergent_tool_a = None
        divergent_tool_b = None
        if div_step_obj:
            if div_step_obj.event_a:
                divergent_tool_a = {
                    "event_id": div_step_obj.event_a.event_id,
                    "tool": div_step_obj.event_a.tool_name,
                    "status": div_step_obj.event_a.status,
                    "input": div_step_obj.event_a.input,
                    "output": div_step_obj.event_a.output,
                    "duration_ms": div_step_obj.event_a.duration_ms,
                    "state_before": div_step_obj.event_a.state_before,
                    "state_after": div_step_obj.event_a.state_after,
                }
            if div_step_obj.event_b:
                divergent_tool_b = {
                    "event_id": div_step_obj.event_b.event_id,
                    "tool": div_step_obj.event_b.tool_name,
                    "status": div_step_obj.event_b.status,
                    "error": div_step_obj.event_b.error,
                    "input": div_step_obj.event_b.input,
                    "output": div_step_obj.event_b.output,
                    "duration_ms": div_step_obj.event_b.duration_ms,
                    "state_before": div_step_obj.event_b.state_before,
                    "state_after": div_step_obj.event_b.state_after,
                }

        # Field-level discrepancies
        field_discrepancies = []
        if div_step_obj and div_step_obj.field_differences:
            for fd in div_step_obj.field_differences:
                field_discrepancies.append({
                    "field": fd.field_name,
                    "trace_a_value": fd.value_a,
                    "trace_b_value": fd.value_b,
                    "difference": fd.description,
                })

        # Downstream cascade steps
        downstream_steps = []
        for step in comparison.aligned_steps:
            if step.alignment_type == "DOWNSTREAM_DIFFERENCE":
                downstream_steps.append({
                    "step_index": step.step_index,
                    "step_name": step.step_name,
                    "tool_name": step.tool_name,
                    "error_b": step.event_b.error if step.event_b else None,
                    "status_a": step.event_a.status if step.event_a else "missing",
                    "status_b": step.event_b.status if step.event_b else "missing",
                })

        evidence_payload = {
            "trace_a_id": comparison.trace_a_id,
            "trace_b_id": comparison.trace_b_id,
            "comparison_id": comparison.comparison_id,
            "first_divergence": {
                "step_index": div_idx,
                "step_name": div_step,
                "summary": comparison.first_divergence_summary,
                "telemetry_trace_a": divergent_tool_a,
                "telemetry_trace_b": divergent_tool_b,
                "field_discrepancies": field_discrepancies,
            },
            "downstream_cascades": {
                "count": comparison.downstream_difference_count,
                "cascade_steps": downstream_steps,
            },
            "investigator_question": user_question or "Conduct a full forensic failure investigation on this divergence.",
        }

        user_content = (
            "Analyze the following real trace investigation evidence and output JSON ONLY with keys:\n"
            "- summary: string (Clear explanation of what happened across the run)\n"
            "- first_divergence_analysis: string (Detailed explanation of what the recorded evidence confirms at the first divergence)\n"
            "- downstream_effects: array of strings (Downstream symptoms and failure cascades)\n"
            "- evidence_citations: array of strings (Confirmed telemetry facts citing specific event IDs and fields)\n"
            "- supported_event_ids: array of integers (Specific Event IDs that support this explanation)\n"
            "- hypotheses: array of strings (Possible root causes, each clearly prefixed with '[UNPROVEN HYPOTHESIS]')\n"
            "- inspect_next: array of strings (Specific logs, endpoints, or metrics the investigator should inspect next)\n"
            "- recommended_remediation: string (Suggested fix for agent prompts, error handling, or retry logic)\n"
            "- safe_testing_checklist: array of strings (Step-by-step verification steps to test the fix safely in an isolated sandbox)\n\n"
            f"REAL INVESTIGATION EVIDENCE:\n{json.dumps(evidence_payload, indent=2, default=str)}"
        )

        return system_prompt, user_content

    def _generate_rule_based_fallback(
        self,
        comparison: ComparisonResult,
        events_a: Optional[List[TraceEvent]] = None,
        events_b: Optional[List[TraceEvent]] = None,
        user_question: Optional[str] = None,
        fallback_reason: str = "",
    ) -> AIExplanation:
        """
        Deterministic, forensic rule-based analyzer that rigorously cites trace evidence
        without hallucination or external dependencies.
        Clearly labeled as 'Rule-based diagnosis'.
        """
        first_step = comparison.first_divergence_step_name or "N/A"
        first_idx = comparison.first_divergence_index

        evidence_citations: List[str] = []
        downstream_effects: List[str] = []
        hypotheses: List[str] = []
        safe_tests: List[str] = []
        inspect_next: List[str] = []
        supported_event_ids: List[int] = []
        remediation: str = ""

        # Extract evidence from aligned steps
        first_step_obj = None
        for step in comparison.aligned_steps:
            if step.step_index == first_idx:
                first_step_obj = step
                if first_idx is not None:
                    supported_event_ids.append(first_idx)
            elif step.alignment_type == "DOWNSTREAM_DIFFERENCE":
                supported_event_ids.append(step.step_index)
                diff_summary = f"Step #{step.step_index} ('{step.step_name}')"
                if step.event_b and step.event_b.error:
                    diff_summary += f" failed with: '{step.event_b.error}'"
                elif step.field_differences:
                    diff_summary += f": {step.field_differences[0].description}"
                downstream_effects.append(diff_summary)

        if first_step_obj:
            tool_name = first_step_obj.tool_name or "internal_routine"
            evidence_citations.append(
                f"Event #{first_idx} ('{first_step}'): Tool '{tool_name}' returned conflicting outputs across runs."
            )
            for diff in first_step_obj.field_differences:
                evidence_citations.append(
                    f"Field '{diff.field_name}': Trace A = {json.dumps(diff.value_a, default=str)} vs Trace B = {json.dumps(diff.value_b, default=str)}"
                )

            # Heuristics based on field differences and output payloads
            output_diff = next((d for d in first_step_obj.field_differences if d.field_name == "output"), None)
            error_diff = next((d for d in first_step_obj.field_differences if d.field_name == "error"), None)

            # Extract error message from either error field or output payload
            err_text = ""
            if error_diff and error_diff.value_b:
                err_text = str(error_diff.value_b)
            elif output_diff and isinstance(output_diff.value_b, dict):
                err_text = str(
                    output_diff.value_b.get("detail")
                    or output_diff.value_b.get("error_code")
                    or output_diff.value_b.get("error")
                    or ""
                )
            elif output_diff and output_diff.value_b:
                err_text = str(output_diff.value_b)

            is_timeout = "timeout" in err_text.lower() or "timed out" in err_text.lower() or "latency" in err_text.lower()

            if is_timeout:
                hypotheses.append(
                    f"[UNPROVEN HYPOTHESIS] Upstream service latency exceeded agent timeout threshold for tool '{tool_name}'."
                )
                hypotheses.append(
                    "[UNPROVEN HYPOTHESIS] Transient network degradation or unhandled concurrency spike during Trace B run."
                )
                safe_tests.append(
                    "Simulate upstream 3500ms delay in an isolated sandbox and verify agent retry and circuit-breaker logic."
                )
                inspect_next.extend([
                    f"Check latency metrics and server logs for '{tool_name}' around the execution timestamp.",
                    f"Review agent timeout configuration ceiling (currently observed failure: '{err_text}').",
                    "Audit downstream dependency behavior when order creation returns null.",
                ])
                remediation = (
                    f"Add exponential backoff with retry (e.g., 3 retries with jitter) to '{tool_name}' "
                    f"and raise timeout ceiling or handle timeout gracefully before terminating downstream workflow."
                )
            elif err_text and ("error" in err_text.lower() or "fail" in err_text.lower()):
                hypotheses.append(
                    f"[UNPROVEN HYPOTHESIS] Tool '{tool_name}' failed due to application-level exception '{err_text}'."
                )
                safe_tests.append(
                    f"Replay '{tool_name}' inputs in sandbox environment with identical mock parameters to observe error."
                )
                inspect_next.extend([
                    f"Check application error logs for '{tool_name}'.",
                    "Verify request payload schema matches API contract.",
                ])
                remediation = f"Update exception handling around '{tool_name}' to capture '{err_text}' and provide rollback."
            elif output_diff:
                hypotheses.append(
                    f"[UNPROVEN HYPOTHESIS] External dependency '{tool_name}' returned unexpected payload format or alternative status code."
                )
                hypotheses.append(
                    "[UNPROVEN HYPOTHESIS] Agent prompt or parsing schema failed to branch correctly on non-standard status."
                )
                safe_tests.append(
                    f"Inject mock response '{json.dumps(output_diff.value_b, default=str)}' to verify agent fallback state transition."
                )
                inspect_next.extend([
                    f"Inspect response contract of tool '{tool_name}'.",
                    "Verify agent schema parser handles optional or alternate fields.",
                ])
                remediation = f"Implement schema verification and fallback branch for '{tool_name}' responses."
            else:
                hypotheses.append(
                    f"[UNPROVEN HYPOTHESIS] Divergence triggered by state transition or input variation at '{first_step}'."
                )
                safe_tests.append("Verify inputs and pre-conditions for this step in isolation.")
                inspect_next.append(f"Audit state snapshots preceding step '{first_step}'.")
                remediation = "Ensure deterministic input sanitization and state persistence."
        else:
            hypotheses.append("[UNPROVEN HYPOTHESIS] Traces appear identical or no divergence was isolated.")
            safe_tests.append("Review full trace logs to verify identical operational environment.")
            inspect_next.append("Review raw trace telemetry timestamps.")
            remediation = "No remediation needed for identical executions."

        # Human-in-the-loop safe testing checklist
        safe_tests.extend([
            "Audit state mutation history prior to divergence point.",
            "Verify environment parity (secrets, mock servers, regional latency) between runs.",
            "Obtain investigator sign-off before committing patch to production agent pipeline.",
        ])

        summary_text = (
            f"Forensic analysis identified the earliest execution divergence at step '{first_step}' (Step #{first_idx or 'N/A'}). "
            f"Subsequent failures ({len(downstream_effects)} downstream steps) are symptomatic cascades. "
            f"Ground truth is based on recorded trace telemetry."
        )

        first_div_analysis = (
            f"Step '{first_step}' marks the first observed divergence where Trace A and Trace B separated. "
            f"Trace A completed successfully, whereas Trace B failed at this point. The recorded evidence confirms this exact divergence; "
            f"underlying tool service internals must be examined as hypothesized."
        )

        return AIExplanation(
            provider="rule_based_fallback",
            provider_label="Rule-based diagnosis",
            summary=summary_text,
            first_divergence_analysis=first_div_analysis,
            downstream_effects=downstream_effects if downstream_effects else ["No downstream cascades observed."],
            evidence_citations=evidence_citations if evidence_citations else ["No conflicting fields recorded."],
            hypotheses=hypotheses,
            safe_testing_checklist=safe_tests,
            recommended_remediation=remediation or "Review tool call contracts and add resilient error handling.",
            is_fallback=True,
            generated_at=datetime.now(timezone.utc).isoformat(),
            supported_event_ids=supported_event_ids,
            inspect_next=inspect_next if inspect_next else ["Audit tool service logs.", "Verify input parameters."],
        )

    async def explain_event(
        self,
        event: TraceEvent,
        trace_events: Optional[List[TraceEvent]] = None,
        prefer_ollama: bool = True,
    ) -> EventExplanation:
        """
        Explains an individual event using Ollama (/api/chat) or rule-based fallback.
        """
        if prefer_ollama:
            try:
                ollama_result = await self._explain_event_ollama(event)
                if ollama_result:
                    return ollama_result
            except Exception as e:
                logger.info(f"Ollama event explanation failed ({str(e)}). Using Rule-based diagnosis.")

        return self._explain_event_fallback(event, trace_events)

    async def _explain_event_ollama(self, event: TraceEvent) -> Optional[EventExplanation]:
        system_prompt = (
            "You are the Qwen AI Investigation Agent for TRACEPOINT.\n"
            "Explain this individual recorded trace event based strictly on the provided telemetry.\n"
            "Return JSON ONLY with keys: analysis (str), input_summary (str), output_summary (str), "
            "state_change_summary (str), potential_impact (str)."
        )

        user_content = json.dumps({
            "event_id": event.event_id,
            "step_name": event.step_name,
            "tool_name": event.tool_name,
            "status": event.status,
            "error": event.error,
            "input": event.input,
            "output": event.output,
            "duration_ms": event.duration_ms,
            "state_before": event.state_before,
            "state_after": event.state_after,
        }, indent=2, default=str)

        chat_body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ollama_url}/api/chat",
                json=chat_body,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("message", {}).get("content", "{}")
                parsed = json.loads(content)
                return EventExplanation(
                    trace_id=event.trace_id,
                    event_id=event.event_id,
                    step_name=event.step_name,
                    tool_name=event.tool_name,
                    provider="ollama",
                    provider_label=f"Qwen ({self.model_name})",
                    is_fallback=False,
                    status=event.status,
                    analysis=parsed.get("analysis", f"Executed step '{event.step_name}'."),
                    input_summary=parsed.get("input_summary", "Input recorded in trace."),
                    output_summary=parsed.get("output_summary", "Output recorded in trace."),
                    state_change_summary=parsed.get("state_change_summary", "State transition captured."),
                    potential_impact=parsed.get("potential_impact", "Analyzed via telemetry."),
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
        return None

    def _explain_event_fallback(self, event: TraceEvent, trace_events: Optional[List[TraceEvent]] = None) -> EventExplanation:
        is_fail = event.status in ["failure", "error"] or bool(event.error)
        tool_desc = f"tool '{event.tool_name}'" if event.tool_name else "internal agent routine"

        input_str = json.dumps(event.input) if event.input else "None"
        output_str = json.dumps(event.output) if event.output else "None"

        if is_fail:
            err = event.error or (event.output.get("detail") if isinstance(event.output, dict) else "Unknown error")
            analysis = (
                f"Event #{event.event_id} ('{event.step_name}') failed during invocation of {tool_desc}. "
                f"Recorded error: '{err}'. This failure interrupted normal agent workflow."
            )
            potential_impact = "High. Triggered execution failure and likely cascaded to downstream steps."
        elif event.status == "warning":
            analysis = (
                f"Event #{event.event_id} ('{event.step_name}') returned a non-standard response from {tool_desc}. "
                f"The agent branched into an alternative handling pathway."
            )
            potential_impact = "Moderate. Caused agent to diverge from golden path into alternative branching."
        else:
            analysis = (
                f"Event #{event.event_id} ('{event.step_name}') executed successfully via {tool_desc}. "
                f"Recorded duration: {event.duration_ms or 'N/A'}ms. Inputs were processed without exceptions."
            )
            potential_impact = "Nominal. Step met execution criteria and advanced agent to subsequent stage."

        input_summary = f"Invoked with parameters: {input_str[:160]}"
        if len(input_str) > 160:
            input_summary += "..."

        output_summary = f"Returned payload: {output_str[:160]}"
        if len(output_str) > 160:
            output_summary += "..."

        if event.state_after and event.state_before:
            changed_keys = [k for k in event.state_after if event.state_before.get(k) != event.state_after.get(k)]
            state_change_summary = f"Mutated state keys: {', '.join(changed_keys)}." if changed_keys else "State remained unchanged."
        elif event.state_after:
            state_change_summary = f"State keys initialized: {', '.join(list(event.state_after.keys())[:4])}."
        else:
            state_change_summary = "No state snapshot recorded for this step."

        return EventExplanation(
            trace_id=event.trace_id,
            event_id=event.event_id,
            step_name=event.step_name,
            tool_name=event.tool_name,
            provider="rule_based_fallback",
            provider_label="Rule-based diagnosis",
            is_fallback=True,
            status=event.status,
            analysis=analysis,
            input_summary=input_summary,
            output_summary=output_summary,
            state_change_summary=state_change_summary,
            potential_impact=potential_impact,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    async def chat_investigation(
        self,
        investigation_id: str,
        question: str,
        comparison: Optional[ComparisonResult],
        events_a: Optional[List[TraceEvent]],
        events_b: Optional[List[TraceEvent]],
        prefer_ollama: bool = True,
    ) -> AIChatResponse:
        """
        Interactive Q&A regarding investigation telemetry.
        Strictly grounded in trace data; missing evidence is explicitly stated.
        """
        if prefer_ollama:
            try:
                ollama_resp = await self._chat_ollama(investigation_id, question, comparison, events_a, events_b)
                if ollama_resp:
                    return ollama_resp
            except Exception as e:
                logger.info(f"Ollama chat query failed ({str(e)}). Using Rule-based diagnosis.")

        return self._chat_fallback(investigation_id, question, comparison, events_a, events_b)

    async def _chat_ollama(
        self,
        investigation_id: str,
        question: str,
        comparison: Optional[ComparisonResult],
        events_a: Optional[List[TraceEvent]],
        events_b: Optional[List[TraceEvent]],
    ) -> Optional[AIChatResponse]:
        system_prompt = (
            "You are the Qwen AI Investigation Agent for TRACEPOINT.\n"
            "CRITICAL EVIDENCE RULES:\n"
            "1. Answer questions STRICTLY and ONLY using the provided trace telemetry and comparison data below.\n"
            "2. If the investigator asks about anything NOT recorded in the telemetry (such as database credentials, external secrets, unrecorded code internals), "
            "you MUST explicitly set missing_evidence_notes and say: 'The recorded trace evidence does not contain information regarding [topic].'\n"
            "3. Clearly distinguish recorded facts from possible hypotheses.\n"
            "4. Return JSON ONLY with keys: answer (str), supporting_evidence (list of str), missing_evidence_notes (str or null)."
        )

        context = {
            "investigation_id": investigation_id,
            "first_divergence": comparison.first_divergence_summary if comparison else "No comparison available",
            "downstream_diff_count": comparison.downstream_difference_count if comparison else 0,
            "events_trace_a": [
                {"event_id": e.event_id, "step": e.step_name, "tool": e.tool_name, "status": e.status, "input": e.input, "output": e.output}
                for e in (events_a or [])
            ],
            "events_trace_b": [
                {"event_id": e.event_id, "step": e.step_name, "tool": e.tool_name, "status": e.status, "err": e.error, "input": e.input, "output": e.output}
                for e in (events_b or [])
            ],
        }

        user_content = (
            f"Context Data:\n{json.dumps(context, indent=2, default=str)}\n\n"
            f"Investigator Question: {question}"
        )

        chat_body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2},
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.ollama_url}/api/chat",
                json=chat_body,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("message", {}).get("content", "{}")
                parsed = json.loads(content)
                return AIChatResponse(
                    investigation_id=investigation_id,
                    question=question,
                    answer=parsed.get("answer", "Evidence analyzed from recorded trace."),
                    supporting_evidence=parsed.get("supporting_evidence", []),
                    missing_evidence_notes=parsed.get("missing_evidence_notes"),
                    provider="ollama",
                    provider_label=f"Qwen ({self.model_name})",
                    is_fallback=False,
                    generated_at=datetime.now(timezone.utc).isoformat(),
                )
        return None

    def _chat_fallback(
        self,
        investigation_id: str,
        question: str,
        comparison: Optional[ComparisonResult],
        events_a: Optional[List[TraceEvent]],
        events_b: Optional[List[TraceEvent]],
    ) -> AIChatResponse:
        q = question.lower().strip()
        evidence: List[str] = []
        missing_notes: Optional[str] = None
        answer: str = ""

        # Analyze question intent against grounded telemetry
        if any(w in q for w in ["why", "fail", "diverge", "first divergence", "timeout", "error", "cause"]):
            if comparison and comparison.first_divergence_step_name:
                div_step = comparison.first_divergence_step_name
                div_idx = comparison.first_divergence_index
                evidence.append(f"Comparison identified First Divergence at step #{div_idx} ('{div_step}').")

                eb = next((e for e in (events_b or []) if e.step_name == div_step), None)
                if eb and eb.error:
                    evidence.append(f"Recorded error in Trace B: '{eb.error}'.")
                    answer = (
                        f"The first observed divergence occurred at step #{div_idx} ('{div_step}'). "
                        f"In Trace A, '{div_step}' completed with status 'SUCCESS'. "
                        f"In Trace B, it failed with recorded error: '{eb.error}'. "
                        f"This failure caused subsequent downstream steps (e.g. order_status returning NOT_FOUND) to fail as cascades. "
                        f"Note: This is a recorded fact; the internal root cause of the service timeout is an unproven hypothesis requiring server log inspection."
                    )
                else:
                    answer = (
                        f"The first observed divergence occurred at step #{div_idx} ('{div_step}'). "
                        f"Outputs differed between Trace A and Trace B at this point."
                    )
            else:
                answer = "No execution divergence or errors were detected in the compared traces."

        elif any(w in q for w in ["payment", "amount", "money", "paid", "txn", "currency", "price"]):
            pay_a = next((e for e in (events_a or []) if "payment" in e.step_name.lower()), None)
            pay_b = next((e for e in (events_b or []) if "payment" in e.step_name.lower()), None)
            if pay_a or pay_b:
                pay = pay_a or pay_b
                evidence.append(f"Step '{pay.step_name}': Input = {json.dumps(pay.input)}")
                evidence.append(f"Step '{pay.step_name}': Output = {json.dumps(pay.output)}")
                answer = (
                    f"The payment check step ('{pay.step_name}') succeeded in both executions. "
                    f"Recorded input amount was {pay.input.get('amount') if isinstance(pay.input, dict) else 'N/A'} "
                    f"{pay.input.get('currency', 'USD') if isinstance(pay.input, dict) else ''} for order {pay.input.get('order_id') if isinstance(pay.input, dict) else 'N/A'}. "
                    f"Transaction ID returned was {pay.output.get('transaction_id') if isinstance(pay.output, dict) else 'N/A'}."
                )
            else:
                answer = "No payment check step was found in the recorded trace events."
                missing_notes = "Payment telemetry is not present in this trace."

        elif any(w in q for w in ["downstream", "cascade", "subsequent", "later"]):
            if comparison and comparison.downstream_difference_count > 0:
                downstream_steps = [s.step_name for s in comparison.aligned_steps if s.alignment_type == "DOWNSTREAM_DIFFERENCE"]
                evidence.append(f"{comparison.downstream_difference_count} downstream differences: {', '.join(downstream_steps)}")
                answer = (
                    f"After the initial divergence at '{comparison.first_divergence_step_name}', "
                    f"there were {comparison.downstream_difference_count} downstream differences: {', '.join(downstream_steps)}. "
                    f"These downstream differences occurred because earlier state/order creation prerequisites were not met."
                )
            else:
                answer = "No downstream differences were observed in this comparison."

        elif any(w in q for w in ["tool", "tools", "api", "apis", "service"]):
            tools_a = list(set([e.tool_name for e in (events_a or []) if e.tool_name]))
            tools_b = list(set([e.tool_name for e in (events_b or []) if e.tool_name]))
            all_tools = list(set(tools_a + tools_b))
            evidence.append(f"Recorded tools in Trace A: {tools_a}")
            evidence.append(f"Recorded tools in Trace B: {tools_b}")
            answer = (
                f"The following tools were invoked during the recorded executions: {', '.join(all_tools)}. "
                f"The tool that experienced failure was '{comparison.aligned_steps[comparison.first_divergence_index - 1].tool_name if comparison and comparison.first_divergence_index else 'N/A'}'."
            )

        elif any(w in q for w in ["state", "memory", "transition"]):
            states = []
            for e in (events_b or []):
                if e.state_after:
                    states.append(f"Step '{e.step_name}': {json.dumps(e.state_after)}")
            evidence.extend(states[:3])
            answer = (
                f"Recorded state transitions in Trace B progressed through: "
                f"{', '.join([f'{e.step_name} -> {e.state_after.get('order_stage', '')}' for e in (events_b or []) if e.state_after])}."
            )

        else:
            missing_notes = (
                f"The investigator's question '{question}' inquires about context that is NOT present in the captured trace evidence."
            )
            answer = (
                f"The recorded trace evidence does not contain information regarding '{question}'. "
                f"TRACEPOINT adheres to strict evidence boundaries: only recorded steps, tool inputs, outputs, "
                f"and state snapshots are verified. Unrecorded internal code, credentials, or external environmental variables are not captured."
            )

        return AIChatResponse(
            investigation_id=investigation_id,
            question=question,
            answer=answer,
            supporting_evidence=evidence,
            missing_evidence_notes=missing_notes,
            provider="rule_based_fallback",
            provider_label="Rule-based diagnosis",
            is_fallback=True,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
