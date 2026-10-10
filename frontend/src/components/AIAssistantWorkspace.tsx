import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Send,
  Sparkles,
  AlertTriangle,
  Layers,
  ShieldCheck,
  CheckSquare,
  Square,
  Lightbulb,
  FileSearch,
  MessageSquare,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Terminal,
  ShieldAlert,
  Search,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import { AIExplanation, AIChatResponse, ComparisonResult, AIStatusResponse } from '../types';

interface AIAssistantWorkspaceProps {
  investigationId: string | null;
  comparison: ComparisonResult | null;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  evidence?: string[];
  missingEvidence?: string | null;
  providerLabel?: string;
  timestamp: string;
}

export const AIAssistantWorkspace: React.FC<AIAssistantWorkspaceProps> = ({
  investigationId,
  comparison,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'chat'>('diagnosis');
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [loadingExpl, setLoadingExpl] = useState(false);
  const [explError, setExplError] = useState<string | null>(null);

  // Diagnosis custom prompt input
  const [diagnosisQuery, setDiagnosisQuery] = useState('');
  const [isSubmittingDiagnosisQuery, setIsSubmittingDiagnosisQuery] = useState(false);

  // AI Provider System Status
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Interactive Safe Checklist
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    if (comparison) {
      loadExplanation();
    }
  }, [investigationId, comparison?.comparison_id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const checkStatus = async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
    } catch {
      // Non-blocking
    }
  };

  const loadExplanation = async (customQuestion?: string) => {
    if (!comparison) return;
    setLoadingExpl(true);
    setExplError(null);
    try {
      let data: AIExplanation;
      if (investigationId) {
        data = await api.explainInvestigation(investigationId, true, customQuestion);
      } else if (comparison.comparison_id) {
        data = await api.explainComparison(comparison.comparison_id, true, customQuestion);
      } else {
        return;
      }
      setExplanation(data);
      checkStatus();
    } catch (err: any) {
      setExplError(err.message || 'Failed to load AI explanation');
    } finally {
      setLoadingExpl(false);
      setIsSubmittingDiagnosisQuery(false);
    }
  };

  const handleCustomDiagnosisSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosisQuery.trim() || loadingExpl) return;
    setIsSubmittingDiagnosisQuery(true);
    loadExplanation(diagnosisQuery.trim());
  };

  const handleSendMessage = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || !comparison || isQuerying) return;

    setInputQuery('');
    const userMsg: ChatMessage = {
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsQuerying(true);

    try {
      let res: AIChatResponse;
      if (investigationId) {
        res = await api.chatInvestigation(investigationId, q, true);
      } else {
        res = await api.chatComparison(comparison.comparison_id, q, true);
      }

      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: res.answer,
        evidence: res.supporting_evidence,
        missingEvidence: res.missing_evidence_notes,
        providerLabel: res.provider_label,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        sender: 'assistant',
        text: `Error querying investigation assistant: ${e.message || 'Service unavailable'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsQuerying(false);
    }
  };

  const toggleChecklist = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const sampleQuestions = [
    'Why did the first divergence occur?',
    'What was the payment check amount and status?',
    'What downstream differences occurred?',
    'What tools were invoked?',
    'What is the customer private password?',
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* Workspace Header */}
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-white">AI Investigation Assistant</h2>
              {explanation && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${
                  explanation.is_fallback
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${explanation.is_fallback ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  {explanation.provider_label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Grounded in comparison telemetry • Deterministic divergence detection
            </p>
          </div>
        </div>

        {/* Tab Controls & Re-run */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('diagnosis')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'diagnosis'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Forensic Diagnosis</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Investigator Q&A</span>
              {chatMessages.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-500 text-[10px] flex items-center justify-center font-bold">
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => loadExplanation()}
            disabled={loadingExpl || !comparison}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
            title="Refresh AI Analysis"
          >
            <RefreshCw className={`w-4 h-4 ${loadingExpl ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Provider Connectivity Banner */}
      {aiStatus && !aiStatus.ollama_available && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Ollama offline at {aiStatus.ollama_url}:</strong> Active diagnosis engine is running in{' '}
              <span className="font-semibold underline">Rule-based diagnosis</span> fallback mode. Start Ollama (`ollama serve`) to enable local Qwen inference.
            </span>
          </div>
        </div>
      )}

      {/* Tab 1: Forensic Diagnosis */}
      {activeTab === 'diagnosis' && (
        <div className="p-6 space-y-6">
          {/* Custom Investigation Focus Input */}
          <form onSubmit={handleCustomDiagnosisSubmit} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            <input
              type="text"
              value={diagnosisQuery}
              onChange={(e) => setDiagnosisQuery(e.target.value)}
              placeholder="Ask Qwen to investigate a specific question or hypothesis about this divergence..."
              className="flex-1 bg-transparent border-none text-xs text-slate-800 focus:outline-none placeholder:text-slate-400"
            />
            {diagnosisQuery && (
              <button
                type="button"
                onClick={() => {
                  setDiagnosisQuery('');
                  loadExplanation();
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 px-2"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={loadingExpl || !diagnosisQuery.trim()}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmittingDiagnosisQuery ? 'Investigating...' : 'Ask Qwen'}</span>
            </button>
          </form>

          {loadingExpl ? (
            <div className="text-center py-12 space-y-2">
              <Sparkles className="w-6 h-6 text-brand-500 animate-spin mx-auto" />
              <div className="text-xs font-semibold text-slate-600">Analyzing first divergence and telemetry evidence...</div>
              <p className="text-[11px] text-slate-400">Querying real execution trace data for divergence ground truth</p>
            </div>
          ) : explError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
              {explError}
            </div>
          ) : !explanation ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Run comparison to view AI investigation diagnostics.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileSearch className="w-3.5 h-3.5 text-slate-600" />
                    What Happened (Telemetry Summary)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                    RECORDED FACT
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {explanation.summary}
                </p>
              </div>

              {/* Supported Event IDs Badge List */}
              {explanation.supported_event_ids && explanation.supported_event_ids.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Supporting Event IDs:
                  </span>
                  {explanation.supported_event_ids.map((id) => (
                    <span
                      key={id}
                      className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300 font-bold"
                    >
                      Event #{id}
                    </span>
                  ))}
                </div>
              )}

              {/* Two Column Breakdown: First Divergence vs Downstream Cascade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Divergence Box */}
                <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      First Observed Divergence
                    </div>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                      Step #{comparison?.first_divergence_index || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-rose-950 font-medium leading-relaxed">
                    {explanation.first_divergence_analysis}
                  </p>
                </div>

                {/* Downstream Effects Box */}
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
                      <Layers className="w-4 h-4 text-amber-600" />
                      Downstream Consequences
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                      {explanation.downstream_effects.length} Cascades
                    </span>
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1 font-medium">
                    {explanation.downstream_effects.map((eff, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{eff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Citations of Recorded Facts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    What Recorded Evidence Confirms (Telemetry Ground Truth)
                  </span>
                  <span className="text-[10px] text-slate-400 italic">Verified event parameters</span>
                </div>
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-xl font-mono text-xs space-y-1.5 max-h-40 overflow-y-auto">
                  {explanation.evidence_citations.map((cite, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-brand-400 font-bold">[{i + 1}]</span>
                      <span>{cite}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hypotheses (Clearly Labelled as Hypotheses) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-brand-600" />
                    Possible Causes (Hypotheses)
                  </span>
                  <span className="text-[10px] bg-blue-100 text-brand-800 font-semibold px-2 py-0.5 rounded border border-blue-200">
                    UNPROVEN HYPOTHESIS
                  </span>
                </div>
                <div className="space-y-2">
                  {explanation.hypotheses.map((hyp, i) => (
                    <div key={i} className="p-3 bg-blue-50/50 border border-blue-200/80 rounded-lg text-xs text-blue-950 font-medium flex items-start gap-2.5">
                      <HelpCircle className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                      <span>{hyp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What the Investigator Should Inspect Next */}
              {explanation.inspect_next && explanation.inspect_next.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-slate-700" />
                    What the Investigator Should Inspect Next
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1.5 pl-1">
                    {explanation.inspect_next.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-brand-500 font-bold">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Remediation (No Automatic Code Execution) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Suggested Fixes (Human Review Required)
                  </span>
                  <span className="text-[11px] text-slate-500 italic">No automated code modification executed</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-800">
                  {explanation.recommended_remediation}
                </div>
              </div>

              {/* Human-in-the-loop Safe Test Checklist */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-emerald-600" />
                    Safe Sandbox Validation Checklist
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Verify safely before applying to agent code
                  </span>
                </div>

                <div className="space-y-2">
                  {explanation.safe_testing_checklist.map((step, idx) => {
                    const isChecked = !!checkedItems[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleChecklist(idx)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                          isChecked
                            ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 line-through'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-300'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <span>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Interactive Forensic Q&A */}
      {activeTab === 'chat' && (
        <div className="flex flex-col h-[540px]">
          {/* Quick Question Chips */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Suggested Queries:
            </span>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isQuerying}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-200 text-xs shrink-0 transition-colors shadow-2xs hover:border-brand-300"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages Thread */}
          <div ref={chatScrollRef} className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <Brain className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-xs font-bold text-slate-700">Ask the AI Investigation Assistant</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Ask questions regarding the first divergence, recorded tool responses, state mutations, or error messages. Responses are restricted strictly to recorded trace evidence.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isUser = msg.sender === 'user';
                return (
                  <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                      <span>{isUser ? 'Investigator' : msg.providerLabel || 'AI Assistant'}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className={`p-4 rounded-xl text-xs max-w-2xl leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-brand-600 text-white rounded-br-xs font-medium'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                    }`}>
                      <p>{msg.text}</p>

                      {/* Supporting Evidence Chips if Assistant */}
                      {!isUser && msg.evidence && msg.evidence.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Supporting Telemetry Evidence:
                          </span>
                          <ul className="space-y-0.5 font-mono text-[11px] text-slate-600">
                            {msg.evidence.map((ev, ei) => (
                              <li key={ei} className="flex items-start gap-1.5">
                                <span className="text-emerald-500 font-bold">✓</span>
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Evidence Boundary Notice */}
                      {!isUser && msg.missingEvidence && (
                        <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span><strong>Evidence Boundary Notice:</strong> {msg.missingEvidence}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isQuerying && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                <Sparkles className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                <span>Evaluating trace evidence and comparison records...</span>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isQuerying || !comparison}
              placeholder={
                comparison
                  ? "Ask about the divergence, payment check, state mutation, or failure cascade..."
                  : "Run trace comparison first"
              }
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isQuerying || !inputQuery.trim() || !comparison}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
