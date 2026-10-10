import React, { useState, useEffect } from 'react';
import {
  Activity,
  PlusCircle,
  FileSearch,
  GitCompare,
  RotateCcw,
  FileText,
  Settings,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { InvestigationRecord } from '../types';
import { api } from '../services/api';

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  investigations: InvestigationRecord[];
  activeInvestigationId: string | null;
  onSelectInvestigation: (id: string) => void;
  onLoadDemo: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  investigations,
  activeInvestigationId,
  onSelectInvestigation,
  onLoadDemo,
  children,
}) => {
  const [engineHealthy, setEngineHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    api.getHealth()
      .then(() => setEngineHealthy(true))
      .catch(() => setEngineHealthy(false));
  }, []);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'new', label: 'New Investigation', icon: PlusCircle },
    { id: 'explorer', label: 'Trace Explorer', icon: FileSearch },
    { id: 'compare', label: 'Compare Traces', icon: GitCompare },
    { id: 'replay', label: 'Replay Lab', icon: RotateCcw },
    { id: 'findings', label: 'Findings & Reports', icon: FileText },
    { id: 'settings', label: 'Settings / About', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                TRACEPOINT
                <span className="text-[10px] bg-brand-900 text-brand-300 px-1.5 py-0.5 rounded font-mono font-normal">v1.0</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Forensic Failure Agent Box</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Forensic Workspace
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Demo CTA */}
        <div className="p-3 m-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            HORIZON 2K26 Demo
          </div>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Load golden vs failing order trace with first divergence diagnostic.
          </p>
          <button
            onClick={onLoadDemo}
            className="w-full py-1.5 px-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            Load Sample Demo
          </button>
        </div>

        {/* Engine Status Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Core Engine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              engineHealthy === true ? 'bg-emerald-400' : engineHealthy === false ? 'bg-rose-500' : 'bg-amber-400'
            }`} />
            <span className="text-[11px] font-mono text-slate-300">
              {engineHealthy === true ? 'Online :8000' : engineHealthy === false ? 'Offline' : 'Connecting'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs">
          {/* Active Investigation Selector */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Active Case:</div>
            <select
              value={activeInvestigationId || ''}
              onChange={(e) => onSelectInvestigation(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-md truncate"
            >
              {investigations.length === 0 ? (
                <option value="">No investigations available</option>
              ) : (
                investigations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.id})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Right Header Status Tag */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-slate-500 font-medium italic">
              "Find the First Divergence. Understand the Failure. Fix It with Evidence."
            </span>
            <div className="bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <span className="w-2 h-2 bg-brand-600 rounded-full animate-ping" />
              Black Box Active
            </div>
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
