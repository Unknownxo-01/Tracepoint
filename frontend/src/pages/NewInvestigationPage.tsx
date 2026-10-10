import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileCheck,
  AlertCircle,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { TraceSummaryItem } from '../types';

interface NewInvestigationPageProps {
  onInvestigationCreated: (invId: string) => void;
  onNavigate: (page: string) => void;
}

export const NewInvestigationPage: React.FC<NewInvestigationPageProps> = ({
  onInvestigationCreated,
  onNavigate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [selectedTraceA, setSelectedTraceA] = useState('');
  const [selectedTraceB, setSelectedTraceB] = useState('');

  // Upload states
  const [uploadSlot, setUploadSlot] = useState<'A' | 'B'>('A');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTraces();
  }, []);

  const loadTraces = async () => {
    try {
      const data = await api.listTraces();
      setTraces(data);
      if (data.length >= 2) {
        if (!selectedTraceA) setSelectedTraceA(data[0].id);
        if (!selectedTraceB) setSelectedTraceB(data[1].id);
      } else if (data.length === 1 && !selectedTraceA) {
        setSelectedTraceA(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await api.uploadTraceFile(file);
      setUploadSuccess(`Trace '${res.trace_id}' (${res.event_count} events) validated successfully.`);
      await loadTraces();

      if (uploadSlot === 'A') {
        setSelectedTraceA(res.trace_id);
      } else {
        setSelectedTraceB(res.trace_id);
      }
    } catch (err: any) {
      setUploadError(err.message || 'File upload and validation failed');
    } finally {
      setUploading(false);
      // Reset input value so same file can be re-uploaded if needed
      e.target.value = '';
    }
  };

  const handleSeedSamples = async () => {
    try {
      setUploading(true);
      setUploadError(null);
      await api.seedSamples();
      await loadTraces();
      setSelectedTraceA('trace_success_001');
      setSelectedTraceB('trace_failed_002');
      setName('Shopping Agent Checkout & Fulfillment Case');
      setDescription('Comparison of golden checkout run vs timeout error at order creation.');
      setUploadSuccess('Sample traces successfully loaded and assigned to Trace A & B.');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to seed sample traces.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setUploadError('Please provide an investigation name.');
      return;
    }
    if (!selectedTraceA) {
      setUploadError('Please select or upload at least Trace A.');
      return;
    }

    setSubmitting(true);
    setUploadError(null);

    try {
      const inv = await api.createInvestigation(
        name.trim(),
        description.trim() || undefined,
        selectedTraceA,
        selectedTraceB || undefined
      );

      // If both A and B are selected, trigger comparison immediately
      if (selectedTraceA && selectedTraceB) {
        await api.compareTraces(selectedTraceA, selectedTraceB, inv.id);
      }

      onInvestigationCreated(inv.id);
      onNavigate('compare');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to create investigation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">New Failure Investigation</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload recorded JSON or JSONL agent execution traces to reconstruct timelines and identify divergence points.
        </p>
      </div>

      {/* Notifications */}
      {uploadError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block text-rose-900">Validation Error</strong>
            <span>{uploadError}</span>
          </div>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 text-sm animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block text-emerald-900">Success</strong>
            <span>{uploadSuccess}</span>
          </div>
        </div>
      )}

      {/* Quick Sample Loader Banner */}
      <div className="bg-brand-50/60 border border-brand-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Want to test with official benchmark traces?</h2>
            <p className="text-xs text-slate-600">
              Loads <code className="font-mono bg-white px-1.5 py-0.5 rounded border text-brand-700">successful_order.json</code> and <code className="font-mono bg-white px-1.5 py-0.5 rounded border text-rose-700">failed_order.json</code> immediately.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSeedSamples}
          disabled={uploading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold shadow-xs shrink-0 transition-all flex items-center gap-1.5"
        >
          {uploading ? 'Loading Samples...' : 'Load Benchmark Samples'}
        </button>
      </div>

      <form onSubmit={handleCreateInvestigation} className="space-y-6">
        {/* Case Metadata Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">1. Investigation Details</h2>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Case Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order Confirmation Failure in Shopping Agent Run #409"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief context regarding the observed failure or expected agent behavior..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Trace Selection & Upload Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">2. Assign Execution Traces</h2>
            <div className="text-xs text-slate-400">Supports .json (array/object) & .jsonl format</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trace A Box */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  Trace A (Reference / Golden Run)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select Existing Trace</label>
                <select
                  value={selectedTraceA}
                  onChange={(e) => setSelectedTraceA(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- Choose Trace A --</option>
                  {traces.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} ({t.event_count} events • {t.status_summary})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block mb-2">Or Upload Trace A</label>
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-brand-400 bg-white rounded-lg cursor-pointer transition-colors group">
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-brand-500 mb-1" />
                  <span className="text-xs font-medium text-slate-600 group-hover:text-brand-600">
                    Upload JSON / JSONL
                  </span>
                  <input
                    type="file"
                    accept=".json,.jsonl"
                    className="hidden"
                    onChange={(e) => {
                      setUploadSlot('A');
                      handleFileUpload(e);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Trace B Box */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Trace B (Comparison / Failing Run)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Select Existing Trace</label>
                <select
                  value={selectedTraceB}
                  onChange={(e) => setSelectedTraceB(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">-- Choose Trace B (Optional) --</option>
                  {traces.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} ({t.event_count} events • {t.status_summary})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block mb-2">Or Upload Trace B</label>
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-rose-400 bg-white rounded-lg cursor-pointer transition-colors group">
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-rose-500 mb-1" />
                  <span className="text-xs font-medium text-slate-600 group-hover:text-rose-600">
                    Upload JSON / JSONL
                  </span>
                  <input
                    type="file"
                    accept=".json,.jsonl"
                    className="hidden"
                    onChange={(e) => {
                      setUploadSlot('B');
                      handleFileUpload(e);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-400 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <span>{submitting ? 'Creating Case...' : 'Start Forensic Analysis'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
