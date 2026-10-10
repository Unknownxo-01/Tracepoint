import React, { useState } from 'react';
import { X, Clock, Database, Terminal, AlertCircle, Copy, Check, Brain, Sparkles } from 'lucide-react';
import { EventExplanation, TraceEvent } from '../types';
import { api } from '../services/api';

interface EventDetailDrawerProps {
  event: TraceEvent | null;
  onClose: () => void;
  titlePrefix?: string;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({ event, onClose, titlePrefix }) => {
  const [copied, setCopied] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<EventExplanation | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  if (!event) return null;

  const handleExplainWithAi = async () => {
    setLoadingAi(true);
    try {
      const exp = await api.explainEvent(event.trace_id, event.event_id, true);
      setAiExplanation(exp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuccess = event.status === 'success';
  const isFailure = event.status === 'failure' || event.status === 'error';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 transform transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${
              isSuccess ? 'bg-emerald-500' : isFailure ? 'bg-rose-500' : 'bg-amber-500'
            }`} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {titlePrefix ? `${titlePrefix} • Event #${event.event_id}` : `Event #${event.event_id}`}
              </div>
              <h2 className="text-lg font-bold text-slate-900">{event.step_name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 text-xs"
              title="Copy JSON"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'JSON'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Tool</span>
              <span className="text-sm font-semibold text-slate-800">{event.tool_name || 'N/A'}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Type</span>
              <span className="text-sm font-semibold text-slate-800">{event.event_type}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Status</span>
              <span className={`text-sm font-semibold capitalize ${
                isSuccess ? 'text-emerald-700' : isFailure ? 'text-rose-700' : 'text-amber-700'
              }`}>{event.status}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500 block">Duration</span>
              <span className="text-sm font-semibold text-slate-800">{event.duration_ms ? `${event.duration_ms} ms` : 'N/A'}</span>
            </div>
          </div>

          {/* Timestamp */}
          {event.timestamp && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Timestamp: <strong className="font-mono text-slate-700">{event.timestamp}</strong></span>
            </div>
          )}

          {/* Error Banner if any */}
          {event.error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-rose-900">Recorded Failure / Error</strong>
                <p className="mt-0.5 font-mono text-xs">{event.error}</p>
              </div>
            </div>
          )}

          {/* AI Forensic Assistant Explanation Block */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  AI Investigation Assistant Diagnosis
                </span>
              </div>
              <button
                onClick={handleExplainWithAi}
                disabled={loadingAi}
                className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${loadingAi ? 'animate-spin' : ''}`} />
                <span>{loadingAi ? 'Analyzing...' : aiExplanation ? 'Re-Analyze' : 'Explain this event'}</span>
              </button>
            </div>

            {aiExplanation ? (
              <div className="space-y-2 pt-1 border-t border-slate-200">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Provider:</span>
                  <span className="font-mono font-bold text-brand-700 bg-white px-2 py-0.5 rounded border">
                    {aiExplanation.provider_label}
                  </span>
                </div>
                <p className="text-xs text-slate-800 bg-white p-2.5 rounded border border-slate-200 leading-relaxed font-medium">
                  {aiExplanation.analysis}
                </p>
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div><strong>State Transition:</strong> {aiExplanation.state_change_summary}</div>
                  <div><strong>Impact:</strong> {aiExplanation.potential_impact}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Click "Explain this event" to request automated forensic analysis of this step's inputs, outputs, and state transitions.
              </p>
            )}
          </div>

          {/* Recorded Tool Input */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              <Terminal className="w-4 h-4 text-brand-600" />
              Recorded Input Payload
            </div>
            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg font-mono text-xs overflow-x-auto max-h-56">
              {event.input !== undefined && event.input !== null ? (
                <pre>{JSON.stringify(event.input, null, 2)}</pre>
              ) : (
                <span className="text-slate-500 italic">No input payload recorded for this step</span>
              )}
            </div>
          </div>

          {/* Recorded Tool Output */}
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Recorded Tool Response / Output
            </div>
            <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-lg font-mono text-xs overflow-x-auto max-h-64">
              {event.output !== undefined && event.output !== null ? (
                <pre>{JSON.stringify(event.output, null, 2)}</pre>
              ) : (
                <span className="text-slate-500 italic">No output recorded</span>
              )}
            </div>
          </div>

          {/* State Before and After */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Database className="w-4 h-4 text-brand-600" />
              State Transitions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs font-medium text-slate-500 block mb-1">State Before Step</span>
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-xs text-slate-800 max-h-40 overflow-y-auto">
                  {event.state_before ? (
                    <pre>{JSON.stringify(event.state_before, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-400 italic">Unrecorded</span>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs font-medium text-slate-500 block mb-1">State After Step</span>
                <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-xs text-slate-800 max-h-40 overflow-y-auto">
                  {event.state_after ? (
                    <pre>{JSON.stringify(event.state_after, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-400 italic">Unrecorded</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
