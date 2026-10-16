import React, { useState } from 'react';
import { AlertData } from '../types/clinical.ts';
import { Web3AuraCard } from './Web3AuraCard.tsx';
import { Bell, Check, AlertOctagon, VolumeX, Sparkles, Loader2 } from 'lucide-react';

interface AlertActionPanelProps {
  alert: AlertData | null;
  selectedIntervention: string;
  onInterventionChange: (intervention: string) => void;
  onTakeAction: (action: 'acknowledge' | 'escalate' | 'mute') => Promise<void>;
  actionStatus: string;
  isActionLoading: boolean;
}

export const AlertActionPanel: React.FC<AlertActionPanelProps> = ({
  alert,
  selectedIntervention,
  onInterventionChange,
  onTakeAction,
  actionStatus,
  isActionLoading
}) => {
  const isCritical = alert?.severity === 'critical';
  const isWarning = alert?.severity === 'warning';

  return (
    <Web3AuraCard
      id="alerts"
      glowColor={isCritical ? 'rose' : isWarning ? 'amber' : 'cyan'}
      title={
        <div className="flex items-center gap-2">
          <Bell className={`w-4 h-4 ${isCritical ? 'text-red-400 animate-bounce' : isWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
          <span className="font-semibold text-white tracking-wide">Clinical Decision Support Alert</span>
        </div>
      }
      badge={
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isCritical
              ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
              : isWarning
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {alert?.severity || 'info'}
        </span>
      }
    >
      <div className="flex flex-col gap-4 my-auto">
        {/* Alert message text */}
        <div
          className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
            isCritical
              ? 'bg-red-950/40 border-red-500/30 text-red-200'
              : isWarning
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
              : 'bg-slate-900/60 border-white/5 text-slate-300'
          }`}
        >
          {alert?.message || 'No active forecast alert.'}
        </div>

        {/* 1-Click Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onTakeAction('acknowledge')}
            disabled={isActionLoading}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 hover:border-cyan-400 text-xs font-semibold text-cyan-200 transition-all shadow-md active:scale-95 disabled:opacity-50"
            type="button"
          >
            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Acknowledge</span>
          </button>

          <button
            onClick={() => onTakeAction('escalate')}
            disabled={isActionLoading}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 hover:border-rose-400 text-xs font-semibold text-rose-200 transition-all shadow-md active:scale-95 disabled:opacity-50"
            type="button"
          >
            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
            <span>Escalate</span>
          </button>

          <button
            onClick={() => onTakeAction('mute')}
            disabled={isActionLoading}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 transition-all shadow-md active:scale-95 disabled:opacity-50"
            type="button"
          >
            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>Mute</span>
          </button>
        </div>

        {/* What-If Simulated Intervention Selection */}
        <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
          <label htmlFor="intervention-select" className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Simulate Clinical Intervention:</span>
          </label>
          <select
            id="intervention-select"
            value={selectedIntervention}
            onChange={(e) => onInterventionChange(e.target.value)}
            className="w-full py-1.5 px-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none cursor-pointer hover:border-cyan-500/50 transition-colors"
          >
            <option value="">No intervention (Natural trajectory)</option>
            <option value="administer_o2">Simulate Supplemental O2 (+1.5% / 5m)</option>
            <option value="bronchodilator">Simulate Bronchodilator (+0.5% / 5m)</option>
          </select>
        </div>

        {/* Action Status Feedback */}
        {actionStatus && (
          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between">
            <span>{actionStatus}</span>
            <span className="text-[10px] text-slate-400">Logged to Event Store</span>
          </div>
        )}
      </div>
    </Web3AuraCard>
  );
};
