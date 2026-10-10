import {
  AIExplanation,
  AIChatResponse,
  AIStatusResponse,
  ComparisonResult,
  DashboardStats,
  InvestigationRecord,
  InvestigationReport,
  ReplayStepResponse,
  TraceEvent,
  TraceMetadata,
  TraceSummaryItem,
} from '../types';

const API_BASE = 'http://localhost:8000/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async listInvestigations(): Promise<InvestigationRecord[]> {
    const res = await fetch(`${API_BASE}/investigations`);
    if (!res.ok) throw new Error('Failed to list investigations');
    return res.json();
  },

  async createInvestigation(name: string, description?: string, trace_a_id?: string, trace_b_id?: string): Promise<InvestigationRecord> {
    const res = await fetch(`${API_BASE}/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, trace_a_id, trace_b_id }),
    });
    if (!res.ok) throw new Error('Failed to create investigation');
    return res.json();
  },

  async getInvestigation(id: string): Promise<InvestigationRecord> {
    const res = await fetch(`${API_BASE}/investigations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch investigation');
    return res.json();
  },

  async listTraces(): Promise<TraceSummaryItem[]> {
    const res = await fetch(`${API_BASE}/traces`);
    if (!res.ok) throw new Error('Failed to list traces');
    return res.json();
  },

  async getTraceMetadata(traceId: string): Promise<TraceMetadata> {
    const res = await fetch(`${API_BASE}/traces/${traceId}`);
    if (!res.ok) throw new Error('Failed to fetch trace metadata');
    return res.json();
  },

  async getTraceEvents(traceId: string): Promise<TraceEvent[]> {
    const res = await fetch(`${API_BASE}/traces/${traceId}/events`);
    if (!res.ok) throw new Error('Failed to fetch trace events');
    return res.json();
  },

  async uploadTraceFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/traces/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload error' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async uploadTraceRaw(content: string, traceId?: string) {
    const res = await fetch(`${API_BASE}/traces/upload-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, trace_id: traceId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload error' }));
      throw new Error(err.detail || 'Raw trace upload failed');
    }
    return res.json();
  },

  async compareTraces(traceAId: string, traceBId: string, investigationId?: string): Promise<ComparisonResult> {
    const res = await fetch(`${API_BASE}/comparisons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trace_a_id: traceAId,
        trace_b_id: traceBId,
        investigation_id: investigationId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Comparison error' }));
      throw new Error(err.detail || 'Failed to execute trace comparison');
    }
    return res.json();
  },

  async getComparison(cmpId: string): Promise<ComparisonResult> {
    const res = await fetch(`${API_BASE}/comparisons/${cmpId}`);
    if (!res.ok) throw new Error('Failed to fetch comparison');
    return res.json();
  },

  async replayStep(traceId: string, step: number): Promise<ReplayStepResponse> {
    const res = await fetch(`${API_BASE}/traces/${traceId}/replay?step=${step}`);
    if (!res.ok) throw new Error('Failed to retrieve replay step');
    return res.json();
  },

  async getAIStatus(): Promise<AIStatusResponse> {
    const res = await fetch(`${API_BASE}/ai/status`);
    if (!res.ok) throw new Error('Failed to fetch AI status');
    return res.json();
  },

  async explainInvestigation(investigationId: string, preferOllama: boolean = true, question?: string): Promise<AIExplanation> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefer_ollama: preferOllama, question }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Explanation error' }));
      throw new Error(err.detail || 'Failed to generate explanation');
    }
    return res.json();
  },

  async explainComparison(comparisonId: string, preferOllama: boolean = true, question?: string): Promise<AIExplanation> {
    const res = await fetch(`${API_BASE}/comparisons/${comparisonId}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefer_ollama: preferOllama, question }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Explanation error' }));
      throw new Error(err.detail || 'Failed to generate comparison explanation');
    }
    return res.json();
  },

  async getReport(investigationId: string): Promise<InvestigationReport> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/report`);
    if (!res.ok) throw new Error('Failed to fetch report');
    return res.json();
  },

  async explainEvent(traceId: string, eventId: number, preferOllama: boolean = true) {
    const res = await fetch(`${API_BASE}/traces/${traceId}/events/${eventId}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefer_ollama: preferOllama }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Event explanation error' }));
      throw new Error(err.detail || 'Failed to explain event');
    }
    return res.json();
  },

  async chatInvestigation(investigationId: string, question: string, preferOllama: boolean = true): Promise<AIChatResponse> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investigation_id: investigationId, question, prefer_ollama: preferOllama }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Chat error' }));
      throw new Error(err.detail || 'Failed to process chat query');
    }
    return res.json();
  },

  async chatComparison(comparisonId: string, question: string, preferOllama: boolean = true): Promise<AIChatResponse> {
    const res = await fetch(`${API_BASE}/comparisons/${comparisonId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investigation_id: comparisonId, question, prefer_ollama: preferOllama }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Chat error' }));
      throw new Error(err.detail || 'Failed to process comparison chat query');
    }
    return res.json();
  },

  getCsvExportUrl(investigationId: string): string {
    return `${API_BASE}/investigations/${investigationId}/export/csv`;
  },

  async seedSamples() {
    const res = await fetch(`${API_BASE}/samples/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to seed sample data');
    return res.json();
  },
};
