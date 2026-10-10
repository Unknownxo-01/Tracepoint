# TRACEPOINT Forensic Architecture Specification

## 1. Sequence Alignment Strategy

Comparing two event logs naively by array indices creates major alignment bugs when an event is omitted or inserted:
```
Trace A: [Payment, InventoryAudit, CreateOrder, Fulfillment]
Trace B: [Payment,                CreateOrder, Fulfillment]
```
If aligned by index:
- Index 1: Payment <-> Payment (Match)
- Index 2: InventoryAudit <-> CreateOrder (False Divergence)
- Index 3: CreateOrder <-> Fulfillment (False Divergence)

### TRACEPOINT Solution: Dual-Key Needleman-Wunsch Alignment
We model trace alignment using dynamic programming:
- **Match Score:**
  - `+4` if `step_name` AND `tool_name` match.
  - `+3` if `step_name` matches.
  - `+1` if `event_type` and relative sequence match.
- **Gap Penalty:** `-1`
- **Mismatch Penalty:** `-2`

After backtracking, the alignment matrix properly aligns corresponding logical steps:
- Step 1: `Payment` <-> `Payment` (MATCH)
- Step 2: `InventoryAudit` <-> `MISSING` (UNMATCHED_A)
- Step 3: `CreateOrder` <-> `CreateOrder` (MATCH)
- Step 4: `Fulfillment` <-> `Fulfillment` (MATCH)

---

## 2. Divergence Isolation Logic

Once aligned, steps are scanned sequentially:
1. Steps matching on input, output, state transition, and status are marked as `MATCH`.
2. The **earliest** step exhibiting any field-level discrepancy (status change, tool response divergence, error, or state mutation) is labeled as **`FIRST_DIVERGENCE`**.
3. All subsequent differing steps are strictly marked as **`DOWNSTREAM_DIFFERENCE`**.
4. Steps present in only one trace are labeled as `UNMATCHED_A` or `UNMATCHED_B`.

---

## 3. Replay Safety Isolation

The Replay Lab implements a virtual state machine:
$$\text{State}(t_k) = \text{State}(t_{k-1}) \oplus \Delta \text{State}(e_k)$$
- No external HTTP requests are dispatched.
- Tool responses are retrieved directly from the immutable recorded trace payload.
- State history is strictly reconstructed from recorded transitions (`state_before` and `state_after`).

---

## 4. AI Assistant Dual-Engine Model

The Investigation Assistant executes with a dual-engine architecture:
1. **Primary (Optional):** Local Ollama client querying `qwen2.5:latest` via JSON-enforced output.
2. **Fallback (Built-in):** Deterministic Forensic Rule-Based Heuristic Engine that scans field-level diffs, identifies error signatures (e.g., timeout vs 404 vs validation error), cites exact trace event lines, and provides a Human-In-The-Loop checklist.
3. **Provider Attestation:** The result payload contains `is_fallback: bool` and `provider_label: str` to ensure zero fabrication of model execution.
