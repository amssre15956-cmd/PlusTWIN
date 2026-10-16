import React from 'react';
import { VitalsData, PatientProfile } from '../types/clinical.ts';
import { Web3AuraCard } from './Web3AuraCard.tsx';
import { Heart, Activity, Wind, User, ShieldCheck, AlertTriangle } from 'lucide-react';

interface VitalsPanelProps {
  vitals: VitalsData;
  profile: PatientProfile;
  selectedPatientId: string;
  onPatientChange: (patientId: string) => void;
  isConnected: boolean;
}

export const VitalsPanel: React.FC<VitalsPanelProps> = ({
  vitals,
  profile,
  selectedPatientId,
  onPatientChange,
  isConnected
}) => {
  const isHypoxemic = vitals.spo2 < 90;
  const isWarning = vitals.spo2 >= 90 && vitals.spo2 <= 93;

  return (
    <Web3AuraCard
      id="patient"
      glowColor={isHypoxemic ? 'rose' : isWarning ? 'amber' : 'cyan'}
      title={
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white tracking-wide">Virtual Patient Digital Twin</span>
        </div>
      }
      badge={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">COHORT:</span>
          <select
            value={selectedPatientId}
            onChange={(e) => onPatientChange(e.target.value)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-200 outline-none cursor-pointer hover:border-cyan-400 transition-colors"
            aria-label="Select Patient Cohort"
          >
            <option value="patient_a">Patient A (Stable Post-op)</option>
            <option value="patient_b">Patient B (Acute Deterioration)</option>
            <option value="patient_c">Patient C (COPD History)</option>
          </select>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto py-2">
        {/* SpO2 */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Oxygen Sat (SpO2)</span>
            <Wind className={`w-3.5 h-3.5 ${isHypoxemic ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-bold font-mono ${isHypoxemic ? 'text-red-400' : isWarning ? 'text-amber-300' : 'text-white'}`}>
              {vitals.spo2.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">%</span>
          </div>
          <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHypoxemic ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (vitals.spo2 - 70) * 3.33))}%` }}
            />
          </div>
        </div>

        {/* HRV */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">HRV Tone</span>
            <Activity className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-white">
              {vitals.hrv_ms.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-mono">ms</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {vitals.hrv_ms < 40 ? 'Autonomic strain' : 'Normal autonomic tone'}
          </span>
        </div>

        {/* Heart Rate */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Heart Rate</span>
            <Heart className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-white">
              {vitals.heart_rate}
            </span>
            <span className="text-xs text-slate-400 font-mono">BPM</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {vitals.heart_rate > 100 ? 'Sinus Tachycardia' : 'Resting sinus rhythm'}
          </span>
        </div>

        {/* Respiration Rate */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Resp. Rate</span>
            <Wind className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-white">
              {vitals.respiration_rate}
            </span>
            <span className="text-xs text-slate-400 font-mono">Br/min</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">
            {vitals.respiration_rate > 22 ? 'Tachypneic drive' : 'Eupneic breathing'}
          </span>
        </div>
      </div>

      {/* Patient Meta Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <User className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-medium text-white">{profile.name}</span>
          <span className="text-slate-500">•</span>
          <span className="text-cyan-300 font-mono">{profile.condition}</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
              <ShieldCheck className="w-3 h-3" /> Live CDS Telemetry
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
              <Activity className="w-3 h-3" /> Synthetic EHR Twin
            </span>
          )}
        </div>
      </div>
    </Web3AuraCard>
  );
};
