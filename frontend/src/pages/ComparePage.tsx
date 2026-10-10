import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Filter,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import {
  AlignedStep,
  ComparisonResult,
  InvestigationRecord,
  TraceEvent,
  TraceSummaryItem,
} from '../types';
import { DiffBadge } from '../components/DiffBadge';
import { EventDetailDrawer } from '../components/EventDetailDrawer';
import { AIAssistantWorkspace } from '../components/AIAssistantWorkspace';
import { Brain } from 'lucide-react';

interface ComparePageProps {
  investigationId: string | null;
  onNavigate: (page: string) => void;
}

export const ComparePage: React.FC<ComparePageProps> = ({ investigationId, onNavigate }) => {
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [selectedTraceA, setSelectedTraceA] = useState('');
  const [selectedTraceB, setSelectedTraceB] = useState('');
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [viewFilter, setViewFilter] = useState<'ALL' | 'DIFFS_ONLY' | 'ERRORS_ONLY'>('ALL');

  // Drawer
  const [inspectorEvent, setInspectorEvent] = useState<{ event: TraceEvent; label: string } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [investigationId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const traceList = await api.listTraces();
      setTraces(traceList);

      if (investigationId) {
        const inv = await api.getInvestigation(investigationId);
        if (inv.trace_a_id) setSelectedTraceA(inv.trace_a_id);
        if (inv.trace_b_id) setSelectedTraceB(inv.trace_b_id);

        if (inv.comparison_id) {
          const cmp = await api.getComparison(inv.comparison_id);
          setComparison(cmp);
        } else if (inv.trace_a_id && inv.trace_b_id) {
          // Trigger comparison
          const cmp = await api.compareTraces(inv.trace_a_id, inv.trace_b_id, inv.id);
          setComparison(cmp);
        }
      } else if (traceList.length >= 2) {
        setSelectedTraceA(traceList[0].id);
        setSelectedTraceB(traceList[1].id);
        const cmp = await api.compareTraces(traceList[0].id, traceList[1].id);
        setComparison(cmp);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to load trace comparison data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunComparison = async () => {
    if (!selectedTraceA || !selectedTraceB) {
      setError('Please select both Trace A and Trace B to compare.');
      return;
    }
    setComparing(true);
    setError(null);
    try {
      const cmp = await api.compareTraces(selectedTraceA, selectedTraceB, investigationId || undefined);
      setComparison(cmp);
    } catch (e: any) {
      setError(e.message || 'Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const filteredSteps = comparison?.aligned_steps.filter((step) => {
    if (viewFilter === 'DIFFS_ONLY') {
      return step.alignment_type !== 'MATCH';
    }
    if (viewFilter === 'ERRORS_ONLY') {
      const hasErrorA = step.event_a?.status === 'failure' || step.event_a?.error;
      const hasErrorB = step.event_b?.status === 'failure' || step.event_b?.error;
      return hasErrorA || hasErrorB;
    }
    return true;
  }) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Controls & Case Selector */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-brand-600" />
            Side-by-Side Trace Comparison
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Deterministic sequence alignment isolating the First Observed Divergence from downstream cascades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Trace A:</span>
            <select
              value={selectedTraceA}
              onChange={(e) => setSelectedTraceA(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              {traces.map((t) => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Trace B:</span>
            <select
              value={selectedTraceB}
              onChange={(e) => setSelectedTraceB(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
            >
              {traces.map((t) => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={comparing}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>{comparing ? 'Aligning...' : 'Re-Compare'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Comparison Forensic Summary Banner */}
      {comparison && (
        <div className={`p-5 rounded-xl border shadow-xs transition-all ${
          comparison.first_divergence_index !== null
            ? 'bg-rose-50/50 border-rose-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  comparison.first_divergence_index !== null
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {comparison.first_divergence_index !== null
                    ? `Divergence at Step #${comparison.first_divergence_index}`
                    : 'Exact Sequence Match'}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Method: {comparison.matching_strategy}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {comparison.summary}
              </h2>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-500">Downstream Cascades</div>
                <div className="text-lg font-black text-amber-600">{comparison.downstream_difference_count} steps</div>
              </div>
              <button
                onClick={() => {
                  document.getElementById('ai-workspace-panel')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Brain className="w-3.5 h-3.5 text-brand-400" />
                Assistant Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Steps ({comparison?.aligned_steps.length || 0})
          </button>
          <button
            onClick={() => setViewFilter('DIFFS_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewFilter === 'DIFFS_ONLY'
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Differences Only ({(comparison?.total_steps_aligned || 0) - (comparison?.matched_count || 0)})
          </button>
          <button
            onClick={() => setViewFilter('ERRORS_ONLY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              viewFilter === 'ERRORS_ONLY'
                ? 'bg-rose-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Errors & Failures
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Matching steps horizontally aligned via LCS backtracking
        </div>
      </div>

      {/* Side-by-Side Aligned Timelines */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Aligning execution timelines...</div>
      ) : !comparison ? (
        <div className="text-center py-16 text-slate-400 text-sm">Select traces and run comparison.</div>
      ) : (
        <div className="space-y-4">
          {filteredSteps.map((step) => {
            const isFirstDivergence = step.alignment_type === 'FIRST_DIVERGENCE';
            const isDownstream = step.alignment_type === 'DOWNSTREAM_DIFFERENCE';
            const isMatch = step.alignment_type === 'MATCH';

            return (
              <div
                key={step.step_index}
                className={`rounded-xl border transition-all ${
                  isFirstDivergence
                    ? 'bg-rose-50/40 border-rose-300 ring-2 ring-rose-400/30 shadow-md'
                    : isDownstream
                    ? 'bg-amber-50/30 border-amber-200 shadow-xs'
                    : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                {/* Step Header Bar */}
                <div className="px-5 py-3 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500">Step #{step.step_index}</span>
                    <h3 className="text-sm font-bold text-slate-900">{step.step_name}</h3>
                    {step.tool_name && (
                      <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-700">
                        {step.tool_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <DiffBadge type={step.alignment_type} />
                  </div>
                </div>

                {/* Diff explanation callout if divergence or downstream */}
                {step.difference_note && !isMatch && (
                  <div className="px-5 py-2.5 bg-white/80 border-b border-slate-200 text-xs font-medium text-slate-800 flex items-center gap-2">
                    <Info className={`w-4 h-4 shrink-0 ${isFirstDivergence ? 'text-rose-600' : 'text-amber-600'}`} />
                    <span>{step.difference_note}</span>
                  </div>
                )}

                {/* Side-by-Side Dual Panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* Left Column: Trace A */}
                  <div className="p-5 space-y-3 bg-slate-50/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-brand-700">
                        Trace A: {comparison.trace_a_id}
                      </span>
                      {step.event_a && (
                        <button
                          onClick={() => setInspectorEvent({ event: step.event_a!, label: `Trace A (${step.step_name})` })}
                          className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Evidence
                        </button>
                      )}
                    </div>

                    {step.event_a ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-bold uppercase ${
                            step.event_a.status === 'success' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {step.event_a.status}
                          </span>
                        </div>

                        {step.event_a.error && (
                          <div className="bg-rose-50 text-rose-700 p-2 rounded border border-rose-200 font-mono text-[11px]">
                            {step.event_a.error}
                          </div>
                        )}

                        <div>
                          <span className="text-slate-500 block mb-1">Recorded Output / Response:</span>
                          <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] text-slate-800 max-h-32 overflow-y-auto">
                            <pre>{JSON.stringify(step.event_a.output, null, 2)}</pre>
                          </div>
                        </div>

                        {step.event_a.state_after && (
                          <div>
                            <span className="text-slate-500 block mb-1">Resulting State:</span>
                            <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700 max-h-24 overflow-y-auto">
                              <pre>{JSON.stringify(step.event_a.state_after, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        Step was omitted or missing in Trace A
                      </div>
                    )}
                  </div>

                  {/* Right Column: Trace B */}
                  <div className={`p-5 space-y-3 ${isFirstDivergence ? 'bg-rose-50/20' : 'bg-slate-50/30'}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-rose-700">
                        Trace B: {comparison.trace_b_id}
                      </span>
                      {step.event_b && (
                        <button
                          onClick={() => setInspectorEvent({ event: step.event_b!, label: `Trace B (${step.step_name})` })}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Evidence
                        </button>
                      )}
                    </div>

                    {step.event_b ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-bold uppercase ${
                            step.event_b.status === 'success' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {step.event_b.status}
                          </span>
                        </div>

                        {step.event_b.error && (
                          <div className="bg-rose-50 text-rose-700 p-2 rounded border border-rose-200 font-mono text-[11px]">
                            {step.event_b.error}
                          </div>
                        )}

                        <div>
                          <span className="text-slate-500 block mb-1">Recorded Output / Response:</span>
                          <div className={`p-2.5 rounded border font-mono text-[11px] max-h-32 overflow-y-auto ${
                            isFirstDivergence ? 'bg-white border-rose-300 text-rose-900' : 'bg-white border-slate-200 text-slate-800'
                          }`}>
                            <pre>{JSON.stringify(step.event_b.output, null, 2)}</pre>
                          </div>
                        </div>

                        {step.event_b.state_after && (
                          <div>
                            <span className="text-slate-500 block mb-1">Resulting State:</span>
                            <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-700 max-h-24 overflow-y-auto">
                              <pre>{JSON.stringify(step.event_b.state_after, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 italic text-xs">
                        Step was omitted or missing in Trace B
                      </div>
                    )}
                  </div>
                </div>

                {/* Field-level Diffs List Footer */}
                {step.field_differences.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Field-Level Discrepancies ({step.field_differences.length})
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {step.field_differences.map((fd, i) => (
                        <div key={i} className="bg-white p-2 rounded border border-slate-200 text-[11px]">
                          <span className="font-mono font-bold text-brand-700">{fd.field_name}: </span>
                          <span className="text-slate-700">{fd.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Investigation Assistant Primary Workspace */}
      {comparison && (
        <div id="ai-workspace-panel" className="pt-2">
          <AIAssistantWorkspace
            investigationId={investigationId}
            comparison={comparison}
          />
        </div>
      )}

      {/* Evidence Drawer */}
      <EventDetailDrawer
        event={inspectorEvent?.event || null}
        onClose={() => setInspectorEvent(null)}
        titlePrefix={inspectorEvent?.label}
      />
    </div>
  );
};
