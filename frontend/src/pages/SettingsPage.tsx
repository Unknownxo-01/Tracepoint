import React, { useState } from 'react';
import {
  Settings,
  Server,
  ShieldCheck,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  Code,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:latest');
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const testOllamaConnection = async () => {
    setTestingOllama(true);
    setOllamaStatus(null);
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`).catch(() => null);
      if (res && res.ok) {
        setOllamaStatus('Ollama host is online and reachable.');
      } else {
        setOllamaStatus('Ollama is not running locally. The platform will automatically use the Rule-Based Forensic Fallback Engine.');
      }
    } catch {
      setOllamaStatus('Ollama is unreachable. Fallback engine is active.');
    } finally {
      setTestingOllama(false);
    }
  };

  const handleReseed = async () => {
    setSeeding(true);
    try {
      await api.seedSamples();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings & About</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure model inference providers, audit safety rules, and review HORIZON 2K26 challenge architecture.
        </p>
      </div>

      {/* Model Provider Config */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Server className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-bold text-slate-900">AI Provider Configuration (Optional)</h2>
        </div>
        <p className="text-xs text-slate-500">
          TRACEPOINT is fully self-sufficient with its built-in deterministic forensic fallback engine.
          You can optionally connect an Ollama instance running Qwen for natural language reasoning.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ollama Host URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Model Tag</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={testOllamaConnection}
            disabled={testingOllama}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            {testingOllama ? 'Probing Ollama...' : 'Test Ollama Connection'}
          </button>
          {ollamaStatus && (
            <span className="text-xs font-medium text-slate-700 italic">
              {ollamaStatus}
            </span>
          )}
        </div>
      </div>

      {/* Benchmark Reset & Data Maintenance */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <RotateCcw className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900">Benchmark Data Maintenance</h2>
        </div>
        <p className="text-xs text-slate-500">
          Reload the default benchmark sample traces (`successful_order.json`, `failed_order.json`, and `changed_tool_response.json`).
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReseed}
            disabled={seeding}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            {seeding ? 'Reloading Benchmark Data...' : 'Re-Seed Benchmark Traces'}
          </button>
          {seedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Samples successfully re-seeded into SQLite.
            </span>
          )}
        </div>
      </div>

      {/* Architecture & Challenge Info */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">HORIZON 2K26 Challenge A07 Architecture</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong>Track 01:</strong> Agentic AI & Intelligent Automation • <strong>Challenge A07:</strong> Agent Black Box — Replay & Failure Investigation
          </p>
          <p>
            <strong>Core Tenet:</strong> A suggested root cause must never be asserted as proven unless recorded telemetry evidence supports it.
            TRACEPOINT distinguishes recorded facts, inferences, and hypotheses.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Deterministic Sequence Engine</span>
              <span>Needleman-Wunsch & LCS dual-key alignment matches steps without artificial index shifting.</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 block mb-1">Zero Side-Effect Replay</span>
              <span>Replay lab strictly reads captured outputs without invoking external APIs or mutating external systems.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
