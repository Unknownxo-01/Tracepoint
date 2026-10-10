import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Sparkles,
  ShieldAlert,
  CheckSquare,
  Square,
  AlertTriangle,
  Lightbulb,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { AIExplanation, InvestigationReport } from '../types';

interface FindingsPageProps {
  investigationId: string | null;
}

export const FindingsPage: React.FC<FindingsPageProps> = ({ investigationId }) => {
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Human-in-the-loop review state
  const [checkedTests, setCheckedTests] = useState<Record<number, boolean>>({});
  const [investigatorDecision, setInvestigatorDecision] = useState<'pending' | 'accepted' | 'rejected'>('pending');

  useEffect(() => {
    if (investigationId) {
      loadReport(investigationId);
    }
  }, [investigationId]);

  const loadReport = async (invId: string) => {
    setLoading(true);
    setError(null);
    try {
      const rep = await api.getReport(invId);
      setReport(rep);
      if (rep.explanation) {
        setExplanation(rep.explanation);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch report');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (preferOllama: boolean = true) => {
    if (!investigationId) return;
    setGeneratingAI(true);
    setError(null);
    try {
      const expl = await api.explainInvestigation(investigationId, preferOllama);
      setExplanation(expl);
      // Reload report to bundle new explanation
      const rep = await api.getReport(investigationId);
      setReport(rep);
    } catch (e: any) {
      setError(e.message || 'Failed to generate explanation');
    } finally {
      setGeneratingAI(false);
    }
  };

  const toggleTest = (index: number) => {
    setCheckedTests((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracepoint_investigation_${report.investigation_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!investigationId) {
    return (
      <div className="max-w-4xl mx-auto p-12 bg-white rounded-xl border border-slate-200 text-center space-y-3">
        <FileText className="w-10 h-10 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">No Active Case Selected</h2>
        <p className="text-sm text-slate-500">Please choose an active case from the top navigation header.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Top Header & Export Buttons */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Case Findings & Forensic Report
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {report?.investigation_name || 'Investigation Findings'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Case ID: <span className="font-mono text-slate-700">{investigationId}</span> • Generated:{' '}
            {report?.created_at ? new Date(report.created_at).toLocaleString() : 'N/A'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadJSON}
            disabled={!report}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <a
            href={api.getCsvExportUrl(investigationId)}
            download
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <button
            onClick={() => handleGenerateAI(true)}
            disabled={generatingAI}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{generatingAI ? 'Analyzing...' : 'Re-Run AI Diagnostics'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* AI Investigation Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Panel Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-brand-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">AI Forensic Investigation Assistant</h2>
              <p className="text-[11px] text-slate-400">Evidence-grounded root divergence diagnosis</p>
            </div>
          </div>

          {/* Provider Label (Crucial: never claim AI model ran if fallback was used) */}
          {explanation && (
            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
              explanation.is_fallback
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
            }`}>
              <span className={`w-2 h-2 rounded-full ${explanation.is_fallback ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span>Provider: {explanation.provider_label}</span>
            </div>
          )}
        </div>

        {/* Panel Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Compiling forensic evidence...</div>
          ) : !explanation ? (
            <div className="text-center py-12 space-y-3">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm text-slate-600">No diagnosis recorded for this case yet.</p>
              <button
                onClick={() => handleGenerateAI(true)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold"
              >
                Generate Diagnostics Now
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Forensic Summary
                </span>
                <p className="text-sm text-slate-800 leading-relaxed font-medium">{explanation.summary}</p>
              </div>

              {/* First Divergence & Downstream Cascade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    First Observed Divergence
                  </div>
                  <p className="text-xs text-rose-950 leading-relaxed font-medium">
                    {explanation.first_divergence_analysis}
                  </p>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Downstream Cascade Breakdown
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1">
                    {explanation.downstream_effects.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 font-medium">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Citations of Recorded Evidence */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Telemetry Evidence Citations
                </span>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                  {explanation.evidence_citations.map((cite, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-brand-400 font-bold">[{idx + 1}]</span>
                      <span>{cite}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Root Cause Hypotheses (Must NOT be presented as proven facts) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Probable Cause Hypotheses (Unverified)
                  </span>
                  <span className="text-[11px] text-slate-400 italic">
                    Requires code-level verification; not asserted as proven fact
                  </span>
                </div>
                <div className="space-y-2">
                  {explanation.hypotheses.map((hyp, idx) => (
                    <div key={idx} className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-lg text-xs text-blue-950 flex items-start gap-2.5 font-medium">
                      <Lightbulb className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                      <span>{hyp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proposed Code / Config Remediation */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Proposed Agent Remediation
                </span>
                <p className="text-xs text-slate-800 font-mono bg-white p-3 rounded border border-slate-200">
                  {explanation.recommended_remediation}
                </p>
              </div>

              {/* Human-in-the-Loop Safe Testing Checklist */}
              <div className="p-5 bg-gradient-to-br from-slate-50 to-brand-50/20 border border-brand-200/80 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-brand-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Human-In-The-Loop Safe Testing Checklist
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-brand-700">
                    Finding → Suggestion → Safe Test → Investigator Review
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Complete these sandbox verifications before applying remediation to the production agent workflow:
                </p>

                <div className="space-y-2">
                  {explanation.safe_testing_checklist.map((testItem, idx) => {
                    const isChecked = !!checkedTests[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleTest(idx)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 line-through'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-brand-300'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span>{testItem}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Investigator Sign-off Action */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Investigator Decision: <strong className="uppercase text-slate-800">{investigatorDecision}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInvestigatorDecision('rejected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        investigatorDecision === 'rejected'
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      Reject Hypothesis
                    </button>
                    <button
                      onClick={() => setInvestigatorDecision('accepted')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        investigatorDecision === 'accepted'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      Accept & Queue Patch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Limitations and Scope Footer */}
      {report?.limitations && (
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            Forensic Scope & Known Telemetry Limitations
          </div>
          <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
            {report.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
