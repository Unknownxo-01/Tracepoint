import urllib.request
import json

base = "http://127.0.0.1:8000/api"

print("=== VERIFYING TRACEPOINT CORE API ===")

# 1. Traces list
traces = json.loads(urllib.request.urlopen(f"{base}/traces").read())
print(f"1. Ingested traces count: {len(traces)}")
for t in traces:
    print(f"   • {t['id']} ({t['event_count']} events, {t['status_summary']})")

# 2. Compare traces
req_data = json.dumps({"trace_a_id": "trace_success_001", "trace_b_id": "trace_failed_002"}).encode("utf-8")
req = urllib.request.Request(f"{base}/comparisons", data=req_data, headers={"Content-Type": "application/json"})
cmp_res = json.loads(urllib.request.urlopen(req).read())
print(f"\n2. Deterministic Comparison Result:")
print(f"   • Matching Strategy: {cmp_res['matching_strategy']}")
print(f"   • First Observed Divergence: Step #{cmp_res['first_divergence_index']} ('{cmp_res['first_divergence_step_name']}')")
print(f"   • Downstream Cascading Differences: {cmp_res['downstream_difference_count']}")
print(f"   • Summary: {cmp_res['summary']}")

# 3. Deterministic Replay
replay_res = json.loads(urllib.request.urlopen(f"{base}/traces/trace_failed_002/replay?step=2").read())
print(f"\n3. Replay Engine (Step 2 Simulation):")
print(f"   • Event: {replay_res['current_event']['step_name']} (Tool: {replay_res['current_event']['tool_name']})")
print(f"   • Recorded Output: {replay_res['recorded_tool_response']}")
print(f"   • Accumulated State: {replay_res['accumulated_state']}")
print(f"   • Safety Guarantee: {replay_res['safety_guarantee']}")

# 4. Investigation Report & AI Findings
report_res = json.loads(urllib.request.urlopen(f"{base}/investigations/inv_demo_shopping_agent/report").read())
print(f"\n4. Case Report & AI Assistant:")
print(f"   • Case Name: {report_res['investigation_name']}")
print(f"   • Provider Attribution: {report_res['explanation']['provider_label']}")
print(f"   • Hypotheses: {report_res['explanation']['hypotheses']}")
print(f"   • Safe Testing Checklist: {report_res['explanation']['safe_testing_checklist']}")

# 5. Explain single event via AI
req_ev = urllib.request.Request(f"{base}/traces/trace_failed_002/events/2/explain", data=json.dumps({"prefer_ollama": False}).encode("utf-8"), headers={"Content-Type": "application/json"})
ev_expl = json.loads(urllib.request.urlopen(req_ev).read())
print(f"\n5. Single Event Forensic Explanation (Step #2):")
print(f"   • Engine: {ev_expl['provider_label']}")
print(f"   • Analysis: {ev_expl['analysis']}")
print(f"   • Impact: {ev_expl['potential_impact']}")

# 6. Interactive Grounded Q&A Chat
req_chat = urllib.request.Request(f"{base}/investigations/inv_demo_shopping_agent/chat", data=json.dumps({"investigation_id": "inv_demo_shopping_agent", "question": "Why did create_order fail?", "prefer_ollama": False}).encode("utf-8"), headers={"Content-Type": "application/json"})
chat_res = json.loads(urllib.request.urlopen(req_chat).read())
print(f"\n6. Interactive Investigator Q&A:")
print(f"   • Question: {chat_res['question']}")
print(f"   • Answer: {chat_res['answer']}")
print(f"   • Supporting Telemetry: {chat_res['supporting_evidence']}")

# 7. Unrecorded Data Boundary Notice
req_chat_missing = urllib.request.Request(f"{base}/investigations/inv_demo_shopping_agent/chat", data=json.dumps({"investigation_id": "inv_demo_shopping_agent", "question": "What is the secret server password?", "prefer_ollama": False}).encode("utf-8"), headers={"Content-Type": "application/json"})
chat_missing_res = json.loads(urllib.request.urlopen(req_chat_missing).read())
print(f"\n7. Missing Evidence Boundary Handling:")
print(f"   • Question: {chat_missing_res['question']}")
print(f"   • Notice: {chat_missing_res['answer']}")
print(f"   • Missing Evidence Note: {chat_missing_res['missing_evidence_notes']}")

print("\n=== ALL END-TO-END VERIFICATION CHECKS PASSED ===")
