import React from 'react';
import { X, Brain, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Terminal, Database } from 'lucide-react';
import { EventExplanation } from '../types';

interface EventExplanationModalProps {
  explanation: EventExplanation | null;
  onClose: () => void;
}

export const EventExplanationModal: React.FC<EventExplanationModalProps> = ({ explanation, onClose }) => {
  if (!explanation) return null;

  const isSuccess = explanation.status === 'success';
  const isFailure = explanation.status === 'failure' || explanation.status === 'error';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                AI Event Telemetry Analysis
              </div>
              <h2 className="text-sm font-bold text-white">
                Step #{explanation.event_id}: {explanation.step_name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Provider Attribution Banner */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Forensic Engine:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
              explanation.is_fallback
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
            }`}>
              {explanation.provider_label}
            </span>
          </div>

          {/* Primary Analysis */}
          <div className={`p-4 rounded-xl border ${
            isFailure
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Forensic Step Diagnosis
            </span>
            <p className="text-xs leading-relaxed font-medium">
              {explanation.analysis}
            </p>
          </div>

          {/* Input & Output Summaries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Terminal className="w-3.5 h-3.5 text-brand-600" />
                Input Payload Summary
              </div>
              <p className="font-mono text-[11px] text-slate-600 leading-snug">
                {explanation.input_summary}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                Recorded Response Summary
              </div>
              <p className="font-mono text-[11px] text-slate-600 leading-snug">
                {explanation.output_summary}
              </p>
            </div>
          </div>

          {/* State Transition */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Database className="w-3.5 h-3.5 text-brand-600" />
              State Mutation Impact
            </div>
            <p className="text-[11px] text-slate-600">
              {explanation.state_change_summary}
            </p>
          </div>

          {/* Potential Impact */}
          <div className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-lg text-xs space-y-1">
            <span className="font-bold text-brand-900 block">Execution Flow Impact:</span>
            <p className="text-[11px] text-brand-800">
              {explanation.potential_impact}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
