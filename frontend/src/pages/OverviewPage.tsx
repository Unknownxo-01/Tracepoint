import React, { useEffect, useState } from 'react';
import {
  FileText,
  AlertTriangle,
  GitCompare,
  Layers,
  ArrowRight,
  Zap,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Brain,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DashboardStats, InvestigationRecord } from '../types';
import { api } from '../services/api';

interface OverviewPageProps {
  onNavigate: (page: string) => void;
  onSelectInvestigation: (id: string) => void;
  onLoadDemo: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onSelectInvestigation,
  onLoadDemo,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const chartData = [
    { name: 'Upstream Timeout', count: 4, fill: '#ef4444' },
    { name: '404 Record Missing', count: 3, fill: '#f97316' },
    { name: 'Stock Outage / Branch', count: 2, fill: '#eab308' },
    { name: 'Schema Mismatch', count: 1, fill: '#3b82f6' },
    { name: 'Successful Clean Runs', count: 6, fill: '#10b981' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
            <span>HORIZON 2K26</span>
            <span>•</span>
            <span>Agent Black Box Forensics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Find the First Divergence. Fix It with Evidence.
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Diagnose silent multi-step failures in autonomous AI agents. Ingest traces, align execution timelines, inspect downstream cascades, and simulate safe replays.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={onLoadDemo}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Launch Live Demo
          </button>
          <button
            onClick={() => onNavigate('new')}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            New Investigation
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Investigations</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats ? stats.total_investigations : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Persistent SQLite storage</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-brand-600 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Traces Ingested</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats ? stats.total_traces : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>JSON & JSONL telemetry</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Divergences Found</div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {stats ? stats.divergent_comparisons : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Earliest deviation isolated</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
            <GitCompare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Captured Errors</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {stats ? stats.total_error_events : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span>Cascading failure events</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* AI Investigation Assistant Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 via-navy-900 to-slate-800 rounded-2xl p-6 border border-slate-700/80 shadow-md text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
            <Brain className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">AI Investigation Assistant</h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                Active Reasoning Hub
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Autonomous forensic reasoning engine for multi-step agent failure analysis. Correlates divergent tool calls, identifies root causes, formulates testable hypotheses, and guides safe sandbox validation.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (stats?.recent_investigations && stats.recent_investigations.length > 0) {
              onSelectInvestigation(stats.recent_investigations[0].id);
            }
            onNavigate('compare');
          }}
          className="px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 group"
        >
          <span>Investigate Trace</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Main Grid: Failure Breakdown Chart & Recent Cases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Failure Categorization & Execution Outcomes</h2>
              <p className="text-xs text-slate-500">Distribution of observed agent divergence types across benchmark runs</p>
            </div>
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-100">
              Deterministic Root Classification
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#93c5fd' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Investigations Column */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Recent Investigations</h2>
              <button
                onClick={() => onNavigate('compare')}
                className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
              >
                View all
              </button>
            </div>

            <div className="space-y-3">
              {stats?.recent_investigations && stats.recent_investigations.length > 0 ? (
                stats.recent_investigations.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onSelectInvestigation(inv.id);
                      onNavigate('compare');
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-all hover:border-brand-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-brand-600">{inv.id}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-1 line-clamp-1">{inv.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{inv.description || 'No description provided'}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No investigations recorded yet. Click "Launch Live Demo" or create a new investigation.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('new')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <span>Create Investigation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
