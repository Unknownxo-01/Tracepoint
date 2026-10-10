export interface TraceEvent {
  trace_id: string;
  agent_name?: string;
  run_id?: string;
  event_id: number;
  timestamp?: string;
  event_type: string;
  step_name: string;
  tool_name?: string;
  input?: any;
  output?: any;
  state_before?: Record<string, any>;
  state_after?: Record<string, any>;
  status: 'success' | 'warning' | 'failure' | 'error' | string;
  error?: string | null;
  duration_ms?: number;
}

export interface TraceMetadata {
  trace_id: string;
  agent_name: string;
  run_id?: string;
  event_count: number;
  error_count: number;
  status_summary: string;
  first_timestamp?: string;
  last_timestamp?: string;
  total_duration_ms?: number;
}

export interface TraceSummaryItem {
  id: string;
  agent_name: string;
  run_id?: string;
  event_count: number;
  error_count: number;
  status_summary: string;
  created_at: string;
}

export interface FieldDifference {
  field_name: string;
  value_a: any;
  value_b: any;
  description: string;
}

export interface AlignedStep {
  step_index: number;
  alignment_type: 'MATCH' | 'FIRST_DIVERGENCE' | 'DOWNSTREAM_DIFFERENCE' | 'UNMATCHED_A' | 'UNMATCHED_B';
  step_name: string;
  tool_name?: string;
  event_a?: TraceEvent;
  event_b?: TraceEvent;
  field_differences: FieldDifference[];
  difference_note?: string;
}

export interface ComparisonResult {
  comparison_id: string;
  trace_a_id: string;
  trace_b_id: string;
  matching_strategy: string;
  total_steps_aligned: number;
  first_divergence_index?: number;
  first_divergence_step_name?: string;
  first_divergence_summary?: string;
  downstream_difference_count: number;
  matched_count: number;
  unmatched_count: number;
  aligned_steps: AlignedStep[];
  summary: string;
  ambiguity_notes?: string;
  created_at: string;
}

export interface InvestigationRecord {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  trace_a_id?: string;
  trace_b_id?: string;
  comparison_id?: string;
  status: string;
}

export interface AIExplanation {
  provider: string;
  provider_label: string;
  summary: string;
  first_divergence_analysis: string;
  downstream_effects: string[];
  evidence_citations: string[];
  hypotheses: string[];
  safe_testing_checklist: string[];
  recommended_remediation: string;
  is_fallback: boolean;
  generated_at: string;
  supported_event_ids?: number[];
  inspect_next?: string[];
}

export interface AIStatusResponse {
  ollama_available: boolean;
  ollama_url: string;
  model_name: string;
  model_installed: boolean;
  available_models: string[];
  status_message: string;
}

export interface EventExplanation {
  trace_id: string;
  event_id: number;
  step_name: string;
  tool_name?: string;
  provider: string;
  provider_label: string;
  is_fallback: boolean;
  status: string;
  analysis: string;
  input_summary: string;
  output_summary: string;
  state_change_summary: string;
  potential_impact: string;
  generated_at: string;
}

export interface AIChatResponse {
  investigation_id: string;
  question: string;
  answer: string;
  supporting_evidence: string[];
  missing_evidence_notes?: string;
  provider: string;
  provider_label: string;
  is_fallback: boolean;
  generated_at: string;
}

export interface ReplayStepResponse {
  trace_id: string;
  step_index: number;
  total_steps: number;
  current_event: TraceEvent;
  accumulated_state: Record<string, any>;
  recorded_tool_response: any;
  is_simulated: boolean;
  safety_guarantee: string;
}

export interface InvestigationReport {
  investigation_id: string;
  investigation_name: string;
  created_at: string;
  trace_a_id?: string;
  trace_b_id?: string;
  trace_a_metadata?: TraceMetadata;
  trace_b_metadata?: TraceMetadata;
  comparison?: ComparisonResult;
  explanation?: AIExplanation;
  limitations: string[];
  next_debugging_steps: string[];
}

export interface DashboardStats {
  total_investigations: number;
  total_traces: number;
  divergent_comparisons: number;
  total_error_events: number;
  recent_investigations: InvestigationRecord[];
  failure_categories: { category: string; count: number }[];
}
