import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Clock,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  Database,
  Eye,
  Layers,
  Brain,
} from 'lucide-react';
import { api } from '../services/api';
import { EventExplanation, TraceEvent, TraceMetadata, TraceSummaryItem } from '../types';
import { EventDetailDrawer } from '../components/EventDetailDrawer';
import { EventExplanationModal } from '../components/EventExplanationModal';

interface TraceExplorerPageProps {
  initialTraceId?: string;
}

export const TraceExplorerPage: React.FC<TraceExplorerPageProps> = ({ initialTraceId }) => {
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>(initialTraceId || '');
  const [metadata, setMetadata] = useState<TraceMetadata | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Event explanation state
  const [eventExplanation, setEventExplanation] = useState<EventExplanation | null>(null);
  const [explainingEventId, setExplainingEventId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toolFilter, setToolFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drawer
  const [activeEvent, setActiveEvent] = useState<TraceEvent | null>(null);

  useEffect(() => {
    api.listTraces().then((list) => {
      setTraces(list);
      if (!selectedTraceId && list.length > 0) {
        setSelectedTraceId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedTraceId) {
      loadTraceData(selectedTraceId);
    }
  }, [selectedTraceId]);

  const loadTraceData = async (traceId: string) => {
    setLoading(true);
    try {
      const [meta, evts] = await Promise.all([
        api.getTraceMetadata(traceId),
        api.getTraceEvents(traceId),
      ]);
      setMetadata(meta);
      setEvents(evts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExplainEvent = async (e: React.MouseEvent, ev: TraceEvent) => {
    e.stopPropagation();
    if (!selectedTraceId) return;
    setExplainingEventId(ev.event_id);
    try {
      const exp = await api.explainEvent(selectedTraceId, ev.event_id, true);
      setEventExplanation(exp);
    } catch (err) {
      console.error(err);
    } finally {
      setExplainingEventId(null);
    }
  };

  // Extract unique tools for filtering
  const uniqueTools = Array.from(new Set(events.map((e) => e.tool_name).filter(Boolean)));

  // Filtered & sorted events
  const filteredEvents = events
    .filter((e) => {
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (toolFilter !== 'ALL' && e.tool_name !== toolFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = e.step_name.toLowerCase().includes(q);
        const matchesTool = (e.tool_name || '').toLowerCase().includes(q);
        const matchesError = (e.error || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTool && !matchesError) return false;
      }
      return true;
    })
    .sort((a, b) => {
      return sortOrder === 'asc' ? a.event_id - b.event_id : b.event_id - a.event_id;
    });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header & Trace Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            Trace Timeline Explorer
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Step-by-step reconstruction of recorded events, tool invocations, and state transitions.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Active Trace:
          </label>
          <select
            value={selectedTraceId}
            onChange={(e) => setSelectedTraceId(e.target.value)}
            className="w-full sm:w-64 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {traces.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} ({t.event_count} events • {t.status_summary})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metadata KPI Row */}
      {metadata && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Agent Name</span>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{metadata.agent_name}</div>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Steps</span>
            <div className="text-sm font-bold text-slate-800 mt-0.5">{metadata.event_count} events</div>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Error Count</span>
            <div className={`text-sm font-bold mt-0.5 ${metadata.error_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {metadata.error_count} detected
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Duration</span>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              {metadata.total_duration_ms ? `${metadata.total_duration_ms} ms` : 'N/A'}
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Run Status</span>
            <div className={`text-sm font-bold mt-0.5 capitalize ${
              metadata.status_summary === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {metadata.status_summary}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search steps, tools, errors..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="failure">Failure / Error</option>
            </select>
          </div>

          {uniqueTools.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Tool:</span>
              <select
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-700"
              >
                <option value="ALL">All Tools</option>
                {uniqueTools.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortOrder === 'asc' ? 'Seq (1 → N)' : 'Seq (N → 1)'}</span>
          </button>
        </div>
      </div>

      {/* Timeline List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading trace events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <Terminal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No events found</h3>
          <p className="text-xs text-slate-400 mt-1">Adjust search keywords or status filters.</p>
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((ev) => {
            const isSuccess = ev.status === 'success';
            const isFailure = ev.status === 'failure' || ev.status === 'error';
            return (
              <div
                key={ev.event_id}
                onClick={() => setActiveEvent(ev)}
                className="relative pl-12 group cursor-pointer"
              >
                {/* Timeline node dot */}
                <div className={`absolute left-4.5 top-4 -ml-1 w-4 h-4 rounded-full border-2 border-white shadow-xs transition-transform group-hover:scale-125 ${
                  isSuccess ? 'bg-emerald-500' : isFailure ? 'bg-rose-500' : 'bg-amber-500'
                }`} />

                {/* Event Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs hover:border-brand-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400">#{ev.event_id}</span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {ev.step_name}
                      </h3>
                      {ev.tool_name && (
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          {ev.tool_name}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isSuccess ? 'bg-emerald-50 text-emerald-700' : isFailure ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {ev.status}
                      </span>
                    </div>

                    {ev.error && (
                      <div className="text-xs font-mono text-rose-600 bg-rose-50/80 px-2.5 py-1 rounded border border-rose-200/80 mt-1">
                        {ev.error}
                      </div>
                    )}

                    {/* Preview of output message if any */}
                    {ev.output && typeof ev.output === 'object' && ev.output.message && (
                      <p className="text-xs text-slate-600 italic">"{ev.output.message}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                    {ev.duration_ms && (
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {ev.duration_ms}ms
                      </span>
                    )}
                    <button
                      onClick={(e) => handleExplainEvent(e, ev)}
                      disabled={explainingEventId === ev.event_id}
                      className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 hover:text-brand-900 rounded border border-brand-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Request AI forensic explanation of this event"
                    >
                      <Brain className={`w-3.5 h-3.5 text-brand-600 ${explainingEventId === ev.event_id ? 'animate-spin' : ''}`} />
                      <span>{explainingEventId === ev.event_id ? 'Analyzing...' : 'Explain this event'}</span>
                    </button>
                    <button
                      onClick={() => setActiveEvent(ev)}
                      className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Details Drawer */}
      <EventDetailDrawer
        event={activeEvent}
        onClose={() => setActiveEvent(null)}
        titlePrefix={selectedTraceId}
      />

      {/* AI Event Explanation Modal */}
      <EventExplanationModal
        explanation={eventExplanation}
        onClose={() => setEventExplanation(null)}
      />
    </div>
  );
};
