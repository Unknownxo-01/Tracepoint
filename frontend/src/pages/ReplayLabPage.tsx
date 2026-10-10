import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ShieldCheck,
  Terminal,
  Database,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import { ReplayStepResponse, TraceSummaryItem } from '../types';

export const ReplayLabPage: React.FC = () => {
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [replayData, setReplayData] = useState<ReplayStepResponse | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1000); // ms per step
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listTraces().then((list) => {
      setTraces(list);
      if (list.length > 0) {
        setSelectedTraceId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedTraceId) {
      loadStep(selectedTraceId, currentStep);
    }
  }, [selectedTraceId, currentStep]);

  // Autoplay timer
  useEffect(() => {
    let timer: any;
    if (isPlaying && replayData) {
      timer = setInterval(() => {
        if (currentStep < replayData.total_steps) {
          setCurrentStep((prev) => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, speed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentStep, replayData, speed]);

  const loadStep = async (traceId: string, step: number) => {
    setLoading(true);
    try {
      const data = await api.replayStep(traceId, step);
      setReplayData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(1);
  };

  const handleStepForward = () => {
    if (replayData && currentStep < replayData.total_steps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepBackward = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const event = replayData?.current_event;
  const isSuccess = event?.status === 'success';
  const isFailure = event?.status === 'failure' || event?.status === 'error';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Safety Guarantee Header Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
              Isolated Deterministic Simulation
              <span className="text-[10px] bg-emerald-200 text-emerald-800 font-mono px-2 py-0.5 rounded-full font-semibold">
                Side-Effect Shield Active
              </span>
            </h2>
            <p className="text-xs text-emerald-800 mt-0.5">
              Replay operates solely on captured trace evidence. Zero live payments, emails, or external API write calls are made.
            </p>
          </div>
        </div>
        <div className="hidden sm:block text-right text-xs font-mono text-emerald-700">
          Target: Isolated Sandbox
        </div>
      </div>

      {/* Replay Controls & Scrubber Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-brand-600" />
              Deterministic Replay Lab
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Step forward and backward through recorded actions, inspect progressive state accumulation, and verify responses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-500 uppercase">Target Trace:</label>
            <select
              value={selectedTraceId}
              onChange={(e) => {
                setSelectedTraceId(e.target.value);
                setCurrentStep(1);
                setIsPlaying(false);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-500"
            >
              {traces.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} ({t.event_count} events • {t.status_summary})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrubber Progress Bar */}
        {replayData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Step #{currentStep} of {replayData.total_steps}</span>
              <span className="font-mono text-brand-600">{event?.step_name}</span>
              <span>{Math.round((currentStep / replayData.total_steps) * 100)}% Replayed</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex cursor-pointer">
              <div
                className="bg-brand-600 h-full transition-all duration-300"
                style={{ width: `${(currentStep / replayData.total_steps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Playback Button Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Reset to Step 1"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleStepBackward}
              disabled={currentStep <= 1}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg transition-colors"
              title="Step Backward"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors font-bold text-xs flex items-center gap-2 shadow-sm"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
            </button>
            <button
              onClick={handleStepForward}
              disabled={!replayData || currentStep >= replayData.total_steps}
              className="p-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-lg transition-colors"
              title="Step Forward"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Replay Pace:</span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { label: '0.5s', val: 500 },
                { label: '1.0s', val: 1000 },
                { label: '2.0s', val: 2000 },
              ].map((sp) => (
                <button
                  key={sp.val}
                  onClick={() => setSpeed(sp.val)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    speed === sp.val ? 'bg-white shadow-xs text-brand-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Inspection Workspace: Event Action vs Accumulated State */}
      {replayData && event && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Current Simulated Action & Tool Output */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${
                  isSuccess ? 'bg-emerald-500' : isFailure ? 'bg-rose-500' : 'bg-amber-500'
                }`} />
                <h3 className="text-base font-bold text-slate-900">
                  Step #{event.event_id}: {event.step_name}
                </h3>
              </div>
              <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                isSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {event.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tool</span>
                <span className="font-semibold text-slate-800">{event.tool_name || 'internal'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-semibold text-slate-800">{event.duration_ms ? `${event.duration_ms}ms` : 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Timestamp</span>
                <span className="font-mono text-[11px] text-slate-700 truncate block">{event.timestamp || 'N/A'}</span>
              </div>
            </div>

            {event.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono text-rose-800">
                <div className="font-bold mb-0.5">Recorded Failure:</div>
                {event.error}
              </div>
            )}

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Recorded Tool Input Payload
              </span>
              <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-xs max-h-36 overflow-y-auto">
                <pre>{JSON.stringify(event.input, null, 2)}</pre>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Recorded Tool Response (Simulated)
              </span>
              <div className="bg-slate-900 text-emerald-300 p-3 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
                <pre>{JSON.stringify(replayData.recorded_tool_response, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Right Column: Progressive Accumulated State Snapshot */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    State Snapshot (Accumulated at t = #{currentStep})
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {Object.keys(replayData.accumulated_state).length} state keys
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Reconstructed internal agent memory after step #{currentStep}. Shows all state mutations committed up to this execution point.
              </p>

              <div className="bg-slate-900 text-amber-300 p-4 rounded-xl font-mono text-xs max-h-80 overflow-y-auto shadow-inner">
                {Object.keys(replayData.accumulated_state).length > 0 ? (
                  <pre>{JSON.stringify(replayData.accumulated_state, null, 2)}</pre>
                ) : (
                  <span className="text-slate-500 italic">No state changes recorded prior to this step.</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>State is deterministic and verified against recorded trace before/after transitions.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
