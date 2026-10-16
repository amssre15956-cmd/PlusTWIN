import React from 'react';
import { PredictionData, EvaluationMetrics } from '../types/clinical.ts';
import { Web3AuraCard } from './Web3AuraCard.tsx';
import { TrendingUp, AlertTriangle, CheckCircle, Info, Sparkles } from 'lucide-react';
import { formatProbability, formatUncertaintyInterval } from '../logic/clinicalEngine.ts';

interface ForecastPanelProps {
  prediction: PredictionData | null;
  metrics?: EvaluationMetrics;
}

export const ForecastPanel: React.FC<ForecastPanelProps> = ({ prediction, metrics }) => {
  const prob = prediction?.probability_score ?? 0;
  const pct = Math.round(prob * 100);
  const isCritical = pct >= 70;
  const isWarning = pct >= 40 && pct < 70;

  const glowColor = isCritical ? 'rose' : isWarning ? 'amber' : 'cyan';

  return (
    <Web3AuraCard
      id="forecast"
      glowColor={glowColor}
      title={
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
          <span className="font-semibold text-white tracking-wide">30-Minute Hypoxemia Forecast</span>
        </div>
      }
      badge={
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-mono">
          Calibrated ({metrics?.calibration_type || 'isotonic'})
        </span>
      }
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 my-auto py-2">
        {/* Deterioration Probability Big Score */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            {/* Circular Ring Gauge */}
            <svg className="w-24 h-24 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="7"
                className="text-slate-800"
                fill="none"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="7"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * pct) / 100}
                strokeLinecap="round"
                className={`transition-all duration-700 ${
                  isCritical ? 'text-red-500' : isWarning ? 'text-amber-400' : 'text-cyan-400'
                }`}
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black font-mono tracking-tight ${
                isCritical ? 'text-red-400' : isWarning ? 'text-amber-300' : 'text-cyan-300'
              }`}>
                {pct}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-slate-400">Risk</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1">
              {isCritical ? (
                <span className="text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> High Deterioration Risk
                </span>
              ) : isWarning ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Moderate Vigilance Needed
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Physiological Stability
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {formatUncertaintyInterval(prediction?.approximate_uncertainty_interval_95)}
            </p>
          </div>
        </div>

        {/* Feature Explanation Box */}
        <div className="flex-1 w-full p-3 rounded-xl bg-slate-950/70 border border-white/5 text-xs">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
            Machine Learning Rationale:
          </span>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {prediction?.explanation || 'Awaiting continuous sensor trajectory telemetry.'}
          </p>
        </div>
      </div>
    </Web3AuraCard>
  );
};
