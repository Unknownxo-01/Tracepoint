import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from trace_schemas import AIExplanation, ComparisonResult

logger = logging.getLogger("tracepoint.ai")


class AIAssistant:
    """
    AI Investigation Assistant for TRACEPOINT.
    Provides evidence-grounded failure explanations, divergence diagnostics,
    hypotheses, and safe-testing checklists.
    Supports local Ollama with a rigorous rule-based fallback engine.
    """

    def __init__(self, ollama_url: str = "http://localhost:11434", model_name: str = "qwen2.5:latest"):
        self.ollama_url = ollama_url.rstrip("/")
        self.model_name = model_name

    async def generate_explanation(
        self,
        comparison: ComparisonResult,
        prefer_ollama: bool = True,
    ) -> AIExplanation:
        """
        Attempts to generate explanation via local Ollama if available and preferred;
        otherwise reliably falls back to TRACEPOINT's Forensic Rule-Based Engine.
        """
        if prefer_ollama:
            try:
                explanation = await self._generate_with_ollama(comparison)
                if explanation:
                    return explanation
            except Exception as e:
                logger.info(f"Ollama unreachable or returned error ({str(e)}). Engaging Rule-Based Fallback Engine.")

        # Reliable rule-based fallback engine
        return self._generate_rule_based_fallback(comparison)

    async def _generate_with_ollama(self, comparison: ComparisonResult) -> Optional[AIExplanation]:
        prompt = self._build_prompt(comparison)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model_name,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_response = data.get("response", "")
                parsed = json.loads(raw_response)

                return AIExplanation(
                    provider="ollama",
                    provider_label=f"Ollama ({self.model_name})",
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
                )
        return None

    def _generate_rule_based_fallback(self, comparison: ComparisonResult) -> AIExplanation:
        """
        Deterministic, forensic rule-based analyzer that rigorously cites trace evidence
        without hallucination or external dependencies.
        """
        first_step = comparison.first_divergence_step_name or "N/A"
        first_idx = comparison.first_divergence_index

        evidence_citations: List[str] = []
        downstream_effects: List[str] = []
        hypotheses: List[str] = []
        safe_tests: List[str] = []
        remediation: str = ""

        # Extract evidence from aligned steps
        first_step_obj = None
        for step in comparison.aligned_steps:
            if step.step_index == first_idx:
                first_step_obj = step
            elif step.alignment_type == "DOWNSTREAM_DIFFERENCE":
                diff_summary = f"Step #{step.step_index} ('{step.step_name}')"
                if step.field_differences:
                    diff_summary += f": {step.field_differences[0].description}"
                downstream_effects.append(diff_summary)

        if first_step_obj:
            tool_name = first_step_obj.tool_name or "internal_routine"
            evidence_citations.append(
                f"Step #{first_idx} ('{first_step}'): Tool '{tool_name}' returned conflicting outputs across runs."
            )
            for diff in first_step_obj.field_differences:
                evidence_citations.append(
                    f"Field '{diff.field_name}': Trace A = {json.dumps(diff.value_a, default=str)} vs Trace B = {json.dumps(diff.value_b, default=str)}"
                )

            # Heuristics based on field differences
            output_diff = next((d for d in first_step_obj.field_differences if d.field_name == "output"), None)
            error_diff = next((d for d in first_step_obj.field_differences if d.field_name == "error"), None)

            if error_diff and error_diff.value_b:
                err_text = str(error_diff.value_b)
                if "timeout" in err_text.lower():
                    hypotheses.append(
                        f"HYPOTHESIS 1: Upstream service latency exceeded agent timeout threshold ({tool_name})."
                    )
                    hypotheses.append(
                        "HYPOTHESIS 2: Network partition or transient service degradation during Trace B run."
                    )
                    safe_tests.append(
                        "Simulate upstream 3500ms delay in isolated sandbox and verify agent retry/circuit-breaker logic."
                    )
                    remediation = (
                        f"Add exponential backoff with retry (e.g. 3 retries max) to '{tool_name}' "
                        f"and increase timeout ceiling or handle timeout gracefully before aborting."
                    )
                else:
                    hypotheses.append(
                        f"HYPOTHESIS: Tool '{tool_name}' failed with application error '{err_text}'."
                    )
                    safe_tests.append(
                        f"Replay '{tool_name}' inputs in sandbox environment with identical mock parameters to observe error."
                    )
                    remediation = f"Update exception handling around '{tool_name}' to capture '{err_text}' and provide rollback."
            elif output_diff:
                hypotheses.append(
                    f"HYPOTHESIS 1: External dependency '{tool_name}' returned unexpected payload format or non-success code."
                )
                hypotheses.append(
                    "HYPOTHESIS 2: Agent prompt or parsing schema failed to branch correctly on alternative status."
                )
                safe_tests.append(
                    f"Inject mock response '{json.dumps(output_diff.value_b)}' to verify agent fallback state transition."
                )
                remediation = f"Implement schema verification and fallback branch for '{tool_name}' responses."
            else:
                hypotheses.append(
                    f"HYPOTHESIS: Divergence triggered by state transition or input variation at '{first_step}'."
                )
                safe_tests.append("Verify inputs and pre-conditions for this step in isolation.")
                remediation = "Ensure deterministic input sanitization and state persistence."
        else:
            hypotheses.append("Traces appear identical or no divergence was isolated.")
            safe_tests.append("Review full trace logs to verify identical operational environment.")
            remediation = "No remediation needed for identical executions."

        # Add human-in-the-loop safe testing checklist
        safe_tests.extend([
            "Audit state mutation history prior to divergence point.",
            "Verify environment parity (secrets, mock servers, regional latency) between runs.",
            "Obtain investigator sign-off before committing patch to production agent pipeline.",
        ])

        summary_text = (
            f"Forensic analysis identified the earliest execution bifurcation at step '{first_step}'. "
            f"Subsequent failures ({len(downstream_effects)} downstream steps) are symptomatic cascades. "
            f"Analysis grounded in recorded trace telemetry."
        )

        first_div_analysis = (
            f"Step '{first_step}' marks the first observed divergence where Trace A and Trace B separated. "
            f"Trace A succeeded while Trace B experienced divergence. The recorded evidence confirms this location; "
            f"underlying tool service internals must be examined as hypothesized."
        )

        return AIExplanation(
            provider="rule_based_fallback",
            provider_label="TRACEPOINT Rule-Based Forensic Fallback Engine",
            summary=summary_text,
            first_divergence_analysis=first_div_analysis,
            downstream_effects=downstream_effects if downstream_effects else ["No downstream cascades observed."],
            evidence_citations=evidence_citations if evidence_citations else ["No conflicting fields recorded."],
            hypotheses=hypotheses,
            safe_testing_checklist=safe_tests,
            recommended_remediation=remediation or "Review tool call contracts and add resilient error handling.",
            is_fallback=True,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _build_prompt(self, comparison: ComparisonResult) -> str:
        data = {
            "first_divergence_step": comparison.first_divergence_step_name,
            "first_divergence_index": comparison.first_divergence_index,
            "summary": comparison.summary,
            "aligned_steps": [
                {
                    "step": s.step_name,
                    "type": s.alignment_type,
                    "diffs": [d.model_dump() for d in s.field_differences],
                }
                for s in comparison.aligned_steps
            ],
        }
        return (
            "You are an AI Forensic Failure Investigator for AI Agent Executions.\n"
            "Analyze the comparison data below and return JSON ONLY with keys:\n"
            "summary (str), first_divergence_analysis (str), downstream_effects (list of str), "
            "evidence_citations (list of str), hypotheses (list of str), "
            "safe_testing_checklist (list of str), recommended_remediation (str).\n\n"
            "Data:\n" + json.dumps(data, indent=2)
        )
